from pathlib import Path

from fastapi import APIRouter, Header

from backend.app.db import search_user_content
from backend.app.dependencies import require_username
from backend.app.schemas import (
    SearchBoardHit,
    SearchCardHit,
    SearchResponse,
)


def create_router(db_path: Path) -> APIRouter:
    router = APIRouter()

    @router.get(
        "/api/search",
        response_model=SearchResponse,
        response_model_exclude_none=True,
    )
    def search(
        q: str = "",
        limit: int = 30,
        authorization: str | None = Header(default=None),
        x_username: str | None = Header(default=None),
    ) -> SearchResponse:
        username = require_username(authorization, x_username)
        results = search_user_content(username, q, limit=limit, db_path=db_path)
        return SearchResponse(
            query=q,
            boards=[SearchBoardHit.model_validate(b) for b in results["boards"]],
            cards=[SearchCardHit.model_validate(c) for c in results["cards"]],
        )

    return router
