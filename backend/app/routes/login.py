from pathlib import Path

from fastapi import APIRouter

from backend.app.auth import authenticate, register_user
from backend.app.schemas import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
)


def create_router(db_path: Path) -> APIRouter:
    router = APIRouter()

    @router.post("/api/login", response_model=AuthResponse)
    def login(payload: LoginRequest) -> AuthResponse:
        result = authenticate(payload.username, payload.password, db_path)
        return AuthResponse.model_validate(result)

    @router.post("/api/register", response_model=AuthResponse, status_code=201)
    def register(payload: RegisterRequest) -> AuthResponse:
        result = register_user(
            username=payload.username,
            password=payload.password,
            display_name=payload.display_name,
            db_path=db_path,
        )
        return AuthResponse.model_validate(result)

    return router
