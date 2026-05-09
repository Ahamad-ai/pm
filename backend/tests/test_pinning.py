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


def register(client: TestClient, username: str) -> dict[str, str]:
    response = client.post(
        "/api/register", json={"username": username, "password": "secret123"}
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['token']}"}


def make_board(
    client: TestClient, headers: dict[str, str], name: str
) -> int:
    response = client.post(
        "/api/boards",
        json={
            "name": name,
            "board": {"columns": [], "cards": {}},
        },
        headers=headers,
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_pin_marks_board_pinned_in_listing(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board(client, alice, "Roadmap")

    response = client.post(f"/api/boards/{board_id}/pin", headers=alice)
    assert response.status_code == 204

    listed = client.get("/api/boards", headers=alice).json()["boards"]
    pinned = [b for b in listed if b["id"] == board_id][0]
    assert pinned["pinned"] is True


def test_pin_is_idempotent(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board(client, alice, "Roadmap")

    first = client.post(f"/api/boards/{board_id}/pin", headers=alice)
    second = client.post(f"/api/boards/{board_id}/pin", headers=alice)
    assert first.status_code == 204
    assert second.status_code == 204


def test_unpin_clears_pinned_flag(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board(client, alice, "Roadmap")
    client.post(f"/api/boards/{board_id}/pin", headers=alice)

    response = client.delete(f"/api/boards/{board_id}/pin", headers=alice)
    assert response.status_code == 204

    listed = client.get("/api/boards", headers=alice).json()["boards"]
    target = [b for b in listed if b["id"] == board_id][0]
    assert target["pinned"] is False


def test_pin_unknown_board_returns_404(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post("/api/boards/9999/pin", headers=alice)
    assert response.status_code == 404


def test_pin_is_per_user(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board(client, alice, "Roadmap")
    # Share with bob so he can see the board
    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "viewer"},
        headers=alice,
    )

    # Alice pins, bob doesn't.
    client.post(f"/api/boards/{board_id}/pin", headers=alice)

    alice_view = client.get("/api/boards", headers=alice).json()["boards"]
    bob_view = client.get("/api/boards", headers=bob).json()["boards"]
    assert any(b["id"] == board_id and b["pinned"] for b in alice_view)
    assert any(b["id"] == board_id and not b["pinned"] for b in bob_view)


def test_pinning_a_collaborator_board_is_allowed(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board(client, alice, "Roadmap")
    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "editor"},
        headers=alice,
    )
    response = client.post(f"/api/boards/{board_id}/pin", headers=bob)
    assert response.status_code == 204


def test_pin_endpoint_requires_auth(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post("/api/boards/1/pin")
    assert response.status_code == 401
