from fastapi import HTTPException

from backend.app.auth import verify_token


def require_username(
    authorization: str | None = None,
    x_username: str | None = None,
) -> str:
    if authorization and authorization.startswith("Bearer "):
        return verify_token(authorization.removeprefix("Bearer "))
    if x_username and x_username.strip():
        return x_username.strip()
    raise HTTPException(
        status_code=401,
        detail="Missing session user. Provide Authorization header.",
    )
