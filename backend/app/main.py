import os
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from backend.app.board_service import get_or_create_board_for_user, save_board_for_user
from backend.app.db import DEFAULT_DB_PATH
from backend.app.openrouter import (
    get_openrouter_api_key,
    normalize_message,
    request_structured_chat,
)
from backend.app.schemas import (
    BoardModel,
    BoardResponse,
    ChatRequest,
    ChatResponse,
    StructuredAIResponse,
)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parents[1]
DEFAULT_STATIC_DIR = BASE_DIR / "static"
FRONTEND_OUT_DIR = PROJECT_ROOT / "frontend" / "out"


def resolve_static_dir() -> Path:
    env_path = os.getenv("PM_STATIC_DIR")
    if env_path:
        return Path(env_path)
    if FRONTEND_OUT_DIR.exists():
        return FRONTEND_OUT_DIR
    return DEFAULT_STATIC_DIR


def resolve_db_path() -> Path:
    env_path = os.getenv("PM_DB_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


def require_username(x_username: str | None) -> str:
    if not x_username or not x_username.strip():
        raise HTTPException(
            status_code=401,
            detail="Missing session user. Provide X-Username header.",
        )
    return x_username.strip()


def apply_board_update_patch(
    candidate_board: dict,
    current_board: dict,
) -> dict:
    current_columns = current_board.get("columns", [])
    current_cards = current_board.get("cards", {})
    candidate_columns = candidate_board.get("columns", [])
    candidate_cards = candidate_board.get("cards", {})

    if not isinstance(current_columns, list) or not isinstance(current_cards, dict):
        return candidate_board
    if not isinstance(candidate_columns, list) or not isinstance(candidate_cards, dict):
        return current_board

    merged_cards = {**current_cards, **candidate_cards}
    merged_columns = [dict(column) for column in current_columns if isinstance(column, dict)]
    index_by_id = {
        column.get("id"): idx
        for idx, column in enumerate(merged_columns)
        if isinstance(column.get("id"), str)
    }

    for patch_column in candidate_columns:
        if not isinstance(patch_column, dict):
            continue
        column_id = patch_column.get("id")
        if not isinstance(column_id, str):
            continue
        patch_card_ids = patch_column.get("cardIds")
        normalized_patch_ids = (
            [card_id for card_id in patch_card_ids if isinstance(card_id, str)]
            if isinstance(patch_card_ids, list)
            else None
        )

        if column_id in index_by_id:
            existing = merged_columns[index_by_id[column_id]]
            updated = dict(existing)
            if isinstance(patch_column.get("title"), str):
                updated["title"] = patch_column["title"]
            if normalized_patch_ids is not None:
                updated["cardIds"] = normalized_patch_ids
            merged_columns[index_by_id[column_id]] = updated
            continue

        merged_columns.append(
            {
                "id": column_id,
                "title": patch_column.get("title", column_id),
                "cardIds": normalized_patch_ids or [],
            }
        )
        index_by_id[column_id] = len(merged_columns) - 1

    # Repair missing card objects for any referenced ids and drop unknown references.
    sanitized_columns = []
    for column in merged_columns:
        card_ids = column.get("cardIds", [])
        if not isinstance(card_ids, list):
            sanitized_columns.append(column)
            continue
        repaired_ids = []
        for card_id in card_ids:
            if not isinstance(card_id, str):
                continue
            if card_id in merged_cards:
                repaired_ids.append(card_id)
        sanitized_columns.append({**column, "cardIds": repaired_ids})

    return {"columns": sanitized_columns, "cards": merged_cards}


async def request_validated_structured_chat(
    *,
    api_key: str,
    board: dict,
    message: str,
    conversation_history: list[dict[str, str]],
) -> StructuredAIResponse:
    attempts = [
        conversation_history,
        [],
    ]
    for history in attempts:
        ai_payload = await request_structured_chat(
            api_key=api_key,
            board=board,
            user_message=message,
            conversation_history=history,
        )
        try:
            return StructuredAIResponse.model_validate(ai_payload)
        except ValidationError:
            continue
    raise HTTPException(
        status_code=502,
        detail="OpenRouter response did not match required structured output.",
    )


def create_app(static_dir: Path | None = None, db_path: Path | None = None) -> FastAPI:
    resolved_static_dir = static_dir or resolve_static_dir()
    resolved_db_path = db_path or resolve_db_path()
    app = FastAPI(title="Project Management MVP API")

    @app.get("/api/hello")
    def hello() -> dict[str, str]:
        return {"message": "Hello from FastAPI"}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/board", response_model=BoardResponse)
    def get_board(x_username: str | None = Header(default=None)) -> BoardResponse:
        username = require_username(x_username)
        board = get_or_create_board_for_user(username, resolved_db_path)
        return BoardResponse(username=username, board=BoardModel.model_validate(board))

    @app.put("/api/board", response_model=BoardResponse)
    def put_board(
        payload: BoardModel, x_username: str | None = Header(default=None)
    ) -> BoardResponse:
        username = require_username(x_username)
        try:
            stored_board = save_board_for_user(
                username, payload.model_dump(mode="python"), resolved_db_path
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return BoardResponse(
            username=username, board=BoardModel.model_validate(stored_board)
        )

    @app.post("/api/chat", response_model=ChatResponse)
    async def chat(
        payload: ChatRequest, x_username: str | None = Header(default=None)
    ) -> ChatResponse:
        username = require_username(x_username)
        message = normalize_message(payload.message)
        api_key = get_openrouter_api_key()
        board = get_or_create_board_for_user(username, resolved_db_path)
        structured = await request_validated_structured_chat(
            api_key=api_key,
            board=board,
            message=message,
            conversation_history=[
                item.model_dump(mode="python") for item in payload.conversation_history
            ],
        )

        next_board = board
        board_updated = structured.board_update is not None
        if structured.board_update is not None:
            candidate_board = structured.board_update.model_dump(mode="python")
            merged_candidate = apply_board_update_patch(
                candidate_board,
                board,
            )
            try:
                next_board = save_board_for_user(
                    username,
                    merged_candidate,
                    resolved_db_path,
                )
            except ValueError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"AI returned invalid board_update: {exc}",
                ) from exc

        return ChatResponse(
            assistant_message=structured.assistant_message,
            board_updated=board_updated,
            board=BoardModel.model_validate(next_board),
        )

    # `/static` keeps direct access to exported files for smoke checks.
    app.mount("/static", StaticFiles(directory=resolved_static_dir), name="static")
    # This serves the full exported Next.js site, including `/_next/*` assets.
    app.mount("/", StaticFiles(directory=resolved_static_dir, html=True), name="frontend")

    return app


app = create_app()
