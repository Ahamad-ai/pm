from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.app.db import get_connection


def create_router(db_path: Path) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        try:
            with get_connection(db_path) as conn:
                conn.execute("SELECT 1")
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Database unavailable.") from exc
        return {"status": "ok"}

    @router.get("/api/hello")
    def hello() -> dict[str, str]:
        return {"message": "Hello from FastAPI"}

    return router
