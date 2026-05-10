from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from backend.app.board_service import get_or_create_board_for_user, save_board_for_user
from backend.app.dependencies import require_username
from backend.app.schemas import BoardModel, BoardResponse


def create_router(db_path: Path) -> APIRouter:
    """Legacy single-board endpoints for backwards compatibility.

    The client may still hit `/api/board` to read or save the user's
    primary board. New clients should use `/api/boards/...`."""
    router = APIRouter()

    @router.get(
        "/api/board",
        response_model=BoardResponse,
        response_model_exclude_none=True,
    )
    def get_board(
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardResponse:
        username = require_username(authorization, x_username)
        board = get_or_create_board_for_user(username, db_path)
        return BoardResponse(username=username, board=BoardModel.model_validate(board))

    @router.put(
        "/api/board",
        response_model=BoardResponse,
        response_model_exclude_none=True,
    )
    def put_board(
        payload: BoardModel,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardResponse:
        username = require_username(authorization, x_username)
        try:
            stored_board = save_board_for_user(
                username, payload.model_dump(mode="python"), db_path
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return BoardResponse(
            username=username, board=BoardModel.model_validate(stored_board)
        )

    return router
