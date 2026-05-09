from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    static_dir = tmp_path / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    (static_dir / "index.html").write_text("<html>ok</html>")
    return TestClient(
        create_app(
            static_dir=static_dir,
            db_path=tmp_path / "pm.sqlite3",
            enable_rate_limit=False,
        )
    )


def register(client: TestClient, username: str, password: str = "secret123") -> str:
    response = client.post(
        "/api/register",
        json={"username": username, "password": password, "display_name": username.title()},
    )
    assert response.status_code == 201
    return response.json()["token"]


def test_get_me_returns_profile(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token = register(client, "alice")
    response = client.get(
        "/api/users/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["display_name"] == "Alice"
    assert body["role"] == "member"


def test_get_me_requires_auth(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/users/me")
    assert response.status_code == 401


def test_update_display_name(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token = register(client, "alice")
    response = client.put(
        "/api/users/me",
        json={"display_name": "Alice Cooper"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Alice Cooper"


def test_update_display_name_rejects_blank(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token = register(client, "alice")
    response = client.put(
        "/api/users/me",
        json={"display_name": "  "},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code in {400, 422}


def test_change_password_round_trip(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token = register(client, "alice", "secret123")
    response = client.post(
        "/api/users/me/password",
        json={"current_password": "secret123", "new_password": "newpass456"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    new_token = response.json()["token"]
    assert new_token

    # Old password no longer works
    bad_login = client.post(
        "/api/login", json={"username": "alice", "password": "secret123"}
    )
    assert bad_login.status_code == 401

    # New password does
    good_login = client.post(
        "/api/login", json={"username": "alice", "password": "newpass456"}
    )
    assert good_login.status_code == 200


def test_change_password_rejects_wrong_current(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token = register(client, "alice", "secret123")
    response = client.post(
        "/api/users/me/password",
        json={"current_password": "wrong", "new_password": "newpass456"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


def test_change_password_rejects_short_new_password(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    token = register(client, "alice", "secret123")
    response = client.post(
        "/api/users/me/password",
        json={"current_password": "secret123", "new_password": "abc"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code in {400, 422}
