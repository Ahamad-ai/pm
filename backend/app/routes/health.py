from pathlib import Path

from fastapi import APIRouter, HTTPException

from backend.app.db import get_connection


def create_router(db_path: Path) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict[str, str]:
        try:
            conn = get_connection(db_path)
            conn.execute("SELECT 1")
            conn.close()
        except Exception:
            raise HTTPException(status_code=503, detail="Database unavailable.")
        return {"status": "ok"}

    @router.get("/api/hello")
    def hello() -> dict[str, str]:
        return {"message": "Hello from FastAPI"}

    return router
