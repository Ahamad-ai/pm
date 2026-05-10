from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from backend.app.db import create_board_for_user, get_board_for_user_by_id
from backend.app.dependencies import require_username
from backend.app.schemas import (
    BoardDetailResponse,
    BoardModel,
    TemplateColumnSummary,
    TemplateEntry,
    TemplateListResponse,
    TemplateInstantiateRequest,
)
from backend.app.templates import get_template_board, list_templates


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

    @router.get("/api/templates", response_model=TemplateListResponse)
    def list_all() -> TemplateListResponse:
        return TemplateListResponse(
            templates=[
                TemplateEntry(
                    id=item["id"],
                    name=item["name"],
                    description=item["description"],
                    default_board_name=item["default_board_name"],
                    columns=[
                        TemplateColumnSummary.model_validate(column)
                        for column in item["columns"]
                    ],
                )
                for item in list_templates()
            ]
        )

    @router.post(
        "/api/boards/from-template/{template_id}",
        response_model=BoardDetailResponse,
        response_model_exclude_none=True,
        status_code=201,
    )
    def create_from_template(
        template_id: str,
        payload: TemplateInstantiateRequest | None = None,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> BoardDetailResponse:
        username = require_username(authorization, x_username)
        template = get_template_board(template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Template not found.")
        name = (payload.name if payload and payload.name else template["name"]).strip() or template["name"]
        try:
            created = create_board_for_user(
                username=username,
                name=name,
                board=template["board"],
                db_path=db_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        record = get_board_for_user_by_id(username, created["id"], db_path)
        if record is None:
            raise HTTPException(status_code=500, detail="Board missing after template create.")
        return _detail_response(username, record)

    return router
