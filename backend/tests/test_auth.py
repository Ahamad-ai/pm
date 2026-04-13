from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.auth import create_token, verify_token
from backend.app.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    static_dir = tmp_path / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    (static_dir / "index.html").write_text("<html>ok</html>")
    return TestClient(create_app(static_dir=static_dir, db_path=tmp_path / "pm.sqlite3", enable_rate_limit=False))


def test_create_and_verify_token() -> None:
    token = create_token("testuser")
    assert verify_token(token) == "testuser"


def test_login_endpoint_returns_token(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post("/api/login", json={"username": "user", "password": "password"})
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["username"] == "user"


def test_login_endpoint_rejects_bad_credentials(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post("/api/login", json={"username": "bad", "password": "bad"})
    assert response.status_code == 401


def test_bearer_token_auth_on_board_endpoint(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token = create_token("user")
    response = client.get("/api/board", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["username"] == "user"


def test_invalid_token_is_rejected(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/board", headers={"Authorization": "Bearer invalid.token.here"})
    assert response.status_code == 401
