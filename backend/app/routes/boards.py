import json
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response

from backend.app.db import (
    add_board_collaborator,
    board_stats,
    create_board_for_user,
    delete_board_for_user,
    disable_board_share_token,
    duplicate_board_for_user,
    enable_board_share_token,
    get_board_for_user_by_id,
    get_board_share_token,
    get_public_board_by_token,
    list_activity_for_board,
    list_board_collaborators,
    list_boards_for_user,
    pin_board_for_user,
    remove_board_collaborator,
    unpin_board_for_user,
    update_board_for_user,
)
from backend.app.dependencies import require_username
from backend.app.schemas import (
    ActivityEntry,
    ActivityResponse,
    BoardCreateRequest,
    BoardDetailResponse,
    BoardDuplicateRequest,
    BoardImportRequest,
    BoardListResponse,
    BoardModel,
    BoardStatsResponse,
    BoardSummary,
    BoardUpdateRequest,
    CollaboratorAddRequest,
    CollaboratorEntry,
    CollaboratorListResponse,
    PublicBoardResponse,
    ShareLinkResponse,
)


def _detail_response(username: str, record: dict) -> BoardDetailResponse:
    return BoardDetailResponse(
        username=username,
        id=int(record["id"]),
        name=record["name"],
        position=int(record["position"]),
        board=BoardModel.model_validate(record["board"]),
        role=record.get("role", "owner"),
        owner=record.get("owner"),
        created_at=record.get("created_at"),
        updated_at=record.get("updated_at"),
    )


def create_router(db_path: Path) -> APIRouter:
    router = APIRouter()

    @router.get(
        "/api/boards",
        response_model=BoardListResponse,
        response_model_exclude_none=True,
    )
    def list_my_boards(
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardListResponse:
        username = require_username(authorization, x_username)
        boards = list_boards_for_user(username, db_path)
        return BoardListResponse(
            username=username,
            boards=[BoardSummary.model_validate(b) for b in boards],
        )

    @router.post(
        "/api/boards",
        response_model=BoardDetailResponse,
        response_model_exclude_none=True,
        status_code=201,
    )
    def create_board(
        payload: BoardCreateRequest,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardDetailResponse:
        username = require_username(authorization, x_username)
        try:
            created = create_board_for_user(
                username=username,
                name=payload.name,
                board=payload.board.model_dump(mode="python") if payload.board else None,
                db_path=db_path,
            )
        except ValueError as exc:
            message = str(exc)
            # A valid token whose `sub` no longer exists in the DB means the
            # client should re-authenticate, not retry with different input.
            status = 401 if message == "user not found" else 400
            raise HTTPException(status_code=status, detail=message) from exc

        record = get_board_for_user_by_id(username, created["id"], db_path)
        if record is None:
            raise HTTPException(status_code=500, detail="Board missing after creation.")
        return _detail_response(username, record)

    @router.get(
        "/api/boards/{board_id}",
        response_model=BoardDetailResponse,
        response_model_exclude_none=True,
    )
    def get_board(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardDetailResponse:
        username = require_username(authorization, x_username)
        record = get_board_for_user_by_id(username, board_id, db_path)
        if record is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        return _detail_response(username, record)

    @router.put(
        "/api/boards/{board_id}",
        response_model=BoardDetailResponse,
        response_model_exclude_none=True,
    )
    def update_board(
        board_id: int,
        payload: BoardUpdateRequest,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardDetailResponse:
        username = require_username(authorization, x_username)
        if payload.board is None and payload.name is None:
            raise HTTPException(
                status_code=400, detail="At least one of `name` or `board` is required."
            )
        try:
            record = update_board_for_user(
                username=username,
                board_id=board_id,
                board=payload.board.model_dump(mode="python") if payload.board else None,
                name=payload.name,
                db_path=db_path,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            message = str(exc)
            status = 404 if message == "board not found" else 400
            raise HTTPException(status_code=status, detail=message) from exc

        return _detail_response(username, record)

    @router.delete("/api/boards/{board_id}", status_code=204)
    def delete_board(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> None:
        username = require_username(authorization, x_username)
        try:
            deleted = delete_board_for_user(username, board_id, db_path)
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        if not deleted:
            raise HTTPException(status_code=404, detail="Board not found.")
        return None

    @router.post(
        "/api/boards/{board_id}/duplicate",
        response_model=BoardDetailResponse,
        response_model_exclude_none=True,
        status_code=201,
    )
    def duplicate_board(
        board_id: int,
        payload: BoardDuplicateRequest | None = None,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardDetailResponse:
        username = require_username(authorization, x_username)
        try:
            created = duplicate_board_for_user(
                username=username,
                source_board_id=board_id,
                name=payload.name if payload else None,
                db_path=db_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        record = get_board_for_user_by_id(username, created["id"], db_path)
        if record is None:
            raise HTTPException(status_code=500, detail="Board missing after duplicate.")
        return _detail_response(username, record)

    @router.post(
        "/api/boards/import",
        response_model=BoardDetailResponse,
        response_model_exclude_none=True,
        status_code=201,
    )
    def import_board(
        payload: BoardImportRequest,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardDetailResponse:
        username = require_username(authorization, x_username)
        name = (payload.name or "Imported board").strip() or "Imported board"
        try:
            created = create_board_for_user(
                username=username,
                name=name,
                board=payload.board.model_dump(mode="python"),
                db_path=db_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        record = get_board_for_user_by_id(username, created["id"], db_path)
        if record is None:
            raise HTTPException(status_code=500, detail="Board missing after import.")
        return _detail_response(username, record)

    @router.get(
        "/api/boards/{board_id}/activity",
        response_model=ActivityResponse,
    )
    def board_activity(
        board_id: int,
        limit: int = 50,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> ActivityResponse:
        username = require_username(authorization, x_username)
        record = get_board_for_user_by_id(username, board_id, db_path)
        if record is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        entries = list_activity_for_board(username, board_id, limit=limit, db_path=db_path)
        return ActivityResponse(
            board_id=board_id,
            entries=[ActivityEntry.model_validate(e) for e in entries],
        )

    @router.get(
        "/api/boards/{board_id}/collaborators",
        response_model=CollaboratorListResponse,
        response_model_exclude_none=True,
    )
    def list_collaborators(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> CollaboratorListResponse:
        username = require_username(authorization, x_username)
        try:
            collaborators = list_board_collaborators(username, board_id, db_path)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return CollaboratorListResponse(
            board_id=board_id,
            collaborators=[CollaboratorEntry.model_validate(c) for c in collaborators],
        )

    @router.post(
        "/api/boards/{board_id}/collaborators",
        response_model=CollaboratorEntry,
        response_model_exclude_none=True,
        status_code=201,
    )
    def add_collaborator(
        board_id: int,
        payload: CollaboratorAddRequest,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> CollaboratorEntry:
        username = require_username(authorization, x_username)
        try:
            entry = add_board_collaborator(
                owner_username=username,
                board_id=board_id,
                collaborator_username=payload.username,
                role=payload.role,
                db_path=db_path,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            message = str(exc)
            status = 404 if message == "board not found" else 400
            raise HTTPException(status_code=status, detail=message) from exc
        return CollaboratorEntry.model_validate(entry)

    @router.delete(
        "/api/boards/{board_id}/collaborators/{collaborator_username}",
        status_code=204,
    )
    def delete_collaborator(
        board_id: int,
        collaborator_username: str,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> None:
        username = require_username(authorization, x_username)
        try:
            removed = remove_board_collaborator(
                owner_username=username,
                board_id=board_id,
                collaborator_username=collaborator_username,
                db_path=db_path,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        if not removed:
            raise HTTPException(status_code=404, detail="Collaborator not found.")
        return None

    @router.get("/api/boards/{board_id}/stats", response_model=BoardStatsResponse)
    def get_board_stats(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardStatsResponse:
        username = require_username(authorization, x_username)
        try:
            stats = board_stats(username, board_id, db_path)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return BoardStatsResponse(board_id=board_id, **stats)

    @router.post(
        "/api/boards/{board_id}/pin",
        status_code=204,
    )
    def pin_board(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> None:
        username = require_username(authorization, x_username)
        try:
            pin_board_for_user(username, board_id, db_path)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return None

    @router.delete(
        "/api/boards/{board_id}/pin",
        status_code=204,
    )
    def unpin_board(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> None:
        username = require_username(authorization, x_username)
        unpin_board_for_user(username, board_id, db_path)
        return None

    @router.get(
        "/api/boards/{board_id}/share",
        response_model=ShareLinkResponse,
        response_model_exclude_none=True,
    )
    def get_share_link(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> ShareLinkResponse:
        username = require_username(authorization, x_username)
        token = get_board_share_token(username, board_id, db_path)
        return ShareLinkResponse(
            board_id=board_id,
            token=token,
            url=f"/share?token={token}" if token else None,
        )

    @router.post(
        "/api/boards/{board_id}/share",
        response_model=ShareLinkResponse,
        response_model_exclude_none=True,
    )
    def enable_share_link(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> ShareLinkResponse:
        username = require_username(authorization, x_username)
        try:
            token = enable_board_share_token(username, board_id, db_path)
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return ShareLinkResponse(
            board_id=board_id,
            token=token,
            url=f"/share?token={token}",
        )

    @router.delete(
        "/api/boards/{board_id}/share",
        status_code=204,
    )
    def disable_share_link(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> None:
        username = require_username(authorization, x_username)
        try:
            removed = disable_board_share_token(username, board_id, db_path)
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        if not removed:
            raise HTTPException(status_code=404, detail="No share link to revoke.")
        return None

    @router.get(
        "/api/public/boards/{token}",
        response_model=PublicBoardResponse,
        response_model_exclude_none=True,
    )
    def public_board(token: str) -> PublicBoardResponse:
        record = get_public_board_by_token(token, db_path)
        if record is None:
            raise HTTPException(status_code=404, detail="Public board not found.")
        return PublicBoardResponse(
            id=int(record["id"]),
            name=record["name"],
            owner=record.get("owner"),
            updated_at=record.get("updated_at"),
            board=BoardModel.model_validate(record["board"]),
        )

    @router.get("/api/boards/{board_id}/export")
    def export_board(
        board_id: int,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> Response:
        username = require_username(authorization, x_username)
        record = get_board_for_user_by_id(username, board_id, db_path)
        if record is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        payload = {
            "name": record["name"],
            "exported_at": record.get("updated_at"),
            "board": record["board"],
        }
        body = json.dumps(payload, indent=2).encode("utf-8")
        safe_name = "".join(
            ch if ch.isalnum() or ch in {"-", "_"} else "_" for ch in record["name"]
        ) or f"board-{board_id}"
        return Response(
            content=body,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.json"'
            },
        )

    return router
