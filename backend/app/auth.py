import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi import HTTPException

from backend.app.db import (
    create_user,
    get_user,
    verify_password,
)

ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24

# Legacy demo credentials. Used only as a seed when no users exist yet
# (so the existing login UI continues to work out of the box).
DEMO_USERNAME = "user"
DEMO_PASSWORD = "password"


def _get_secret_key() -> str:
    key = os.getenv("PM_JWT_SECRET", "").strip()
    if not key:
        key = "pm-mvp-dev-secret-not-for-production"
    return key


def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, _get_secret_key(), algorithm=ALGORITHM)


def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username or not isinstance(username, str):
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")


def _ensure_demo_user(db_path: Path) -> None:
    existing = get_user(DEMO_USERNAME, db_path)
    if existing is not None:
        return
    try:
        create_user(
            username=DEMO_USERNAME,
            password=DEMO_PASSWORD,
            display_name="Demo User",
            role="admin",
            db_path=db_path,
        )
    except ValueError:
        pass


def authenticate(username: str, password: str, db_path: Path) -> dict:
    cleaned_username = username.strip() if isinstance(username, str) else ""
    cleaned_password = password if isinstance(password, str) else ""
    if not cleaned_username or not cleaned_password:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    _ensure_demo_user(db_path)

    user = get_user(cleaned_username, db_path)
    if user is None or not verify_password(cleaned_password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    token = create_token(user["username"])
    return {
        "token": token,
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "role": user.get("role") or "member",
    }


def register_user(
    username: str,
    password: str,
    display_name: str | None,
    db_path: Path,
) -> dict:
    if not isinstance(username, str) or not isinstance(password, str):
        raise HTTPException(status_code=400, detail="username and password are required")
    cleaned_username = username.strip()
    if not cleaned_username:
        raise HTTPException(status_code=400, detail="username is required")
    if not password or len(password) < 6:
        raise HTTPException(
            status_code=400, detail="password must be at least 6 characters"
        )
    try:
        user = create_user(
            username=cleaned_username,
            password=password,
            display_name=display_name,
            role="member",
            db_path=db_path,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    token = create_token(user["username"])
    return {
        "token": token,
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "role": user.get("role") or "member",
    }
