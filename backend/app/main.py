import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.app.config import resolve_db_path, resolve_static_dir
from backend.app.routes import board, chat, health, login

limiter = Limiter(key_func=get_remote_address)


def create_app(
    static_dir: Path | None = None,
    db_path: Path | None = None,
    enable_rate_limit: bool = True,
) -> FastAPI:
    resolved_static_dir = static_dir or resolve_static_dir()
    resolved_db_path = db_path or resolve_db_path()
    app = FastAPI(title="Project Management MVP API")

    # --- Rate limiting ---
    if enable_rate_limit:
        app.state.limiter = limiter

        @app.exception_handler(RateLimitExceeded)
        async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded. Try again later."},
            )

    # --- CORS ---
    allowed_origins = os.getenv("PM_CORS_ORIGINS", "").strip()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins.split(",") if allowed_origins else [],
        allow_credentials=True,
        allow_methods=["GET", "PUT", "POST"],
        allow_headers=["Content-Type", "X-Username", "Authorization"],
    )

    # --- Routes ---
    app.include_router(health.create_router(resolved_db_path))
    app.include_router(login.router)
    app.include_router(board.create_router(resolved_db_path))
    app.include_router(chat.create_router(resolved_db_path, limiter, enable_rate_limit))

    # --- Static file serving ---
    app.mount("/static", StaticFiles(directory=resolved_static_dir), name="static")
    app.mount("/", StaticFiles(directory=resolved_static_dir, html=True), name="frontend")

    return app


app = create_app()
