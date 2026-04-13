from fastapi import APIRouter

from backend.app.auth import authenticate

router = APIRouter()


@router.post("/api/login")
def login(payload: dict) -> dict[str, str]:
    username = payload.get("username", "")
    password = payload.get("password", "")
    token = authenticate(username, password)
    return {"token": token, "username": username.strip()}
