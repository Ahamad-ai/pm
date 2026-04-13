import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException

ALGORITHM = "HS256"
TOKEN_EXPIRY_HOURS = 24

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


def authenticate(username: str, password: str) -> str:
    if username.strip() == DEMO_USERNAME and password.strip() == DEMO_PASSWORD:
        return create_token(username.strip())
    raise HTTPException(status_code=401, detail="Invalid credentials.")
