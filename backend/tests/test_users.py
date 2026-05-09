from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.db import (
    create_user,
    get_user,
    hash_password,
    list_users,
    update_user_password,
    verify_password,
)
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


def test_hash_and_verify_password_round_trip() -> None:
    hashed = hash_password("hunter2")
    assert hashed.startswith("scrypt$")
    assert verify_password("hunter2", hashed) is True
    assert verify_password("hunter3", hashed) is False
    assert verify_password("hunter2", None) is False
    assert verify_password("hunter2", "garbage$value") is False


def test_hash_password_rejects_short_passwords() -> None:
    with pytest.raises(ValueError):
        hash_password("abc")


def test_create_user_persists_password_hash(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    user = create_user("alice", "secret123", display_name="Alice", db_path=db_path)
    assert user["username"] == "alice"
    assert user["display_name"] == "Alice"
    assert user["role"] == "member"

    fetched = get_user("alice", db_path)
    assert fetched is not None
    assert verify_password("secret123", fetched["password_hash"]) is True


def test_create_user_rejects_duplicate(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    create_user("alice", "secret123", db_path=db_path)
    with pytest.raises(ValueError):
        create_user("alice", "another1", db_path=db_path)


def test_create_user_rejects_invalid_username(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    with pytest.raises(ValueError):
        create_user("bad name!", "secret123", db_path=db_path)


def test_update_user_password_changes_hash(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    create_user("alice", "secret123", db_path=db_path)
    original = get_user("alice", db_path)
    assert original is not None
    update_user_password("alice", "newpass456", db_path=db_path)
    updated = get_user("alice", db_path)
    assert updated is not None
    assert verify_password("newpass456", updated["password_hash"]) is True
    assert verify_password("secret123", updated["password_hash"]) is False
    assert original["password_hash"] != updated["password_hash"]


def test_list_users_returns_all_known_users(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    create_user("alice", "secret123", db_path=db_path)
    create_user("bob", "secret456", display_name="Bob", db_path=db_path)
    rows = list_users(db_path)
    usernames = sorted(row["username"] for row in rows)
    assert usernames == ["alice", "bob"]


# ---------------- HTTP integration ----------------


def test_register_endpoint_creates_user_and_returns_token(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post(
        "/api/register",
        json={"username": "carol", "password": "letmein123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "carol"
    assert body["token"]
    assert body["role"] == "member"

    # Carol can immediately log in with her new credentials.
    login = client.post(
        "/api/login",
        json={"username": "carol", "password": "letmein123"},
    )
    assert login.status_code == 200


def test_register_rejects_short_password(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post(
        "/api/register",
        json={"username": "carol", "password": "abc"},
    )
    assert response.status_code in {400, 422}


def test_register_rejects_duplicate_username(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    first = client.post(
        "/api/register",
        json={"username": "carol", "password": "letmein123"},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/register",
        json={"username": "carol", "password": "letmein123"},
    )
    assert second.status_code == 400


def test_login_now_requires_real_password(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    # `user`/`password` is auto-seeded by authenticate(); a wrong password is
    # still rejected.
    bad = client.post(
        "/api/login", json={"username": "user", "password": "wrongpass"}
    )
    assert bad.status_code == 401
    good = client.post(
        "/api/login", json={"username": "user", "password": "password"}
    )
    assert good.status_code == 200


def test_register_then_use_board_endpoints(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    register = client.post(
        "/api/register",
        json={"username": "dave", "password": "letmein123", "display_name": "Dave"},
    )
    assert register.status_code == 201
    token = register.json()["token"]

    boards = client.get(
        "/api/boards", headers={"Authorization": f"Bearer {token}"}
    )
    assert boards.status_code == 200
    assert boards.json()["username"] == "dave"
    # A freshly registered user has no boards yet.
    assert boards.json()["boards"] == []
