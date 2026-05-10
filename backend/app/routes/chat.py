import logging
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import ValidationError
from slowapi import Limiter

from backend.app.board_patch import apply_board_update_patch
from backend.app.board_service import resolve_board_for_chat
from backend.app.db import record_activity, update_board_for_user
from backend.app.dependencies import require_username
from backend.app.openrouter import (
    get_openrouter_api_key,
    normalize_message,
    request_structured_chat,
)
from backend.app.schemas import (
    BoardModel,
    ChatRequest,
    ChatResponse,
    StructuredAIResponse,
)

logger = logging.getLogger(__name__)


async def _request_validated_structured_chat(
    *,
    api_key: str,
    board: dict,
    message: str,
    conversation_history: list[dict[str, str]],
) -> StructuredAIResponse:
    last_error: ValidationError | None = None
    for history in (conversation_history, []):
        ai_payload = await request_structured_chat(
            api_key=api_key,
            board=board,
            user_message=message,
            conversation_history=history,
        )
        try:
            return StructuredAIResponse.model_validate(ai_payload)
        except ValidationError as exc:
            logger.warning(
                "Structured output validation failed (history_len=%d): %s",
                len(history),
                exc,
            )
            last_error = exc
    raise HTTPException(
        status_code=502,
        detail=f"OpenRouter response did not match required structured output: {last_error}",
    )


def create_router(
    db_path: Path,
    limiter: Limiter,
    enable_rate_limit: bool,
) -> APIRouter:
    router = APIRouter()

    @router.post("/api/chat", response_model=ChatResponse)
    @limiter.limit("10/minute", exempt_when=lambda: not enable_rate_limit)
    async def chat(
        request: Request,
        payload: ChatRequest,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> ChatResponse:
        username = require_username(authorization, x_username)
        message = normalize_message(payload.message)
        api_key = get_openrouter_api_key()

        try:
            board_id, board = resolve_board_for_chat(username, payload.board_id, db_path)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

        structured = await _request_validated_structured_chat(
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
                record = update_board_for_user(
                    username=username,
                    board_id=board_id,
                    board=merged_candidate,
                    db_path=db_path,
                )
            except PermissionError as exc:
                raise HTTPException(status_code=403, detail=str(exc)) from exc
            except ValueError as exc:
                raise HTTPException(
                    status_code=422,
                    detail=f"AI returned invalid board_update: {exc}",
                ) from exc
            next_board = record["board"]
            try:
                record_activity(
                    username=username,
                    board_id=board_id,
                    action="board.ai_updated",
                    details={"summary": structured.assistant_message[:160]},
                    db_path=db_path,
                )
            except ValueError:
                pass

        return ChatResponse(
            assistant_message=structured.assistant_message,
            board_updated=board_updated,
            board=BoardModel.model_validate(next_board),
            board_id=board_id,
        )

    return router
