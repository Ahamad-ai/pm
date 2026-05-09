from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


SIMPLE_BOARD = {
    "columns": [{"id": "col-1", "title": "To do", "cardIds": ["card-1"]}],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Task",
            "details": "",
            "priority": "high",
            "dueDate": "2000-01-01",
        }
    },
}


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
    body = response.json()
    return {"Authorization": f"Bearer {body['token']}"}


def create_board(client: TestClient, headers: dict[str, str], name: str = "Roadmap") -> int:
    response = client.post(
        "/api/boards",
        json={"name": name, "board": SIMPLE_BOARD},
        headers=headers,
    )
    assert response.status_code == 201
    return int(response.json()["id"])


# ---------------- Sharing ----------------


def test_owner_can_add_editor_who_can_then_update(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)

    add = client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "editor"},
        headers=alice,
    )
    assert add.status_code == 201
    assert add.json()["role"] == "editor"

    # Bob now sees the board in his list (with role=editor).
    listed = client.get("/api/boards", headers=bob).json()["boards"]
    shared = [b for b in listed if b["id"] == board_id]
    assert shared and shared[0]["role"] == "editor"
    assert shared[0]["owner"] == "alice"

    # Bob can update.
    next_board = {
        "columns": [{"id": "col-1", "title": "Done", "cardIds": []}],
        "cards": {},
    }
    update = client.put(
        f"/api/boards/{board_id}",
        json={"board": next_board},
        headers=bob,
    )
    assert update.status_code == 200


def test_viewer_cannot_update_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)

    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "viewer"},
        headers=alice,
    )

    next_board = {
        "columns": [{"id": "c", "title": "X", "cardIds": []}],
        "cards": {},
    }
    update = client.put(
        f"/api/boards/{board_id}",
        json={"board": next_board},
        headers=bob,
    )
    assert update.status_code == 403


def test_viewer_can_read_board_and_activity(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)

    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "viewer"},
        headers=alice,
    )

    fetch = client.get(f"/api/boards/{board_id}", headers=bob)
    assert fetch.status_code == 200
    assert fetch.json()["role"] == "viewer"

    activity = client.get(f"/api/boards/{board_id}/activity", headers=bob)
    assert activity.status_code == 200
    actions = [e["action"] for e in activity.json()["entries"]]
    assert "board.collaborator_added" in actions


def test_collaborator_cannot_delete_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)
    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "editor"},
        headers=alice,
    )
    response = client.delete(f"/api/boards/{board_id}", headers=bob)
    assert response.status_code == 403


def test_collaborator_cannot_rename_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)
    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "editor"},
        headers=alice,
    )
    response = client.put(
        f"/api/boards/{board_id}",
        json={"name": "New name"},
        headers=bob,
    )
    assert response.status_code == 403


def test_collaborator_cannot_add_other_collaborators(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    register(client, "carol")
    board_id = create_board(client, alice)
    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "editor"},
        headers=alice,
    )
    response = client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "carol", "role": "viewer"},
        headers=bob,
    )
    assert response.status_code == 403


def test_owner_can_remove_collaborator(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)
    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "editor"},
        headers=alice,
    )
    response = client.delete(
        f"/api/boards/{board_id}/collaborators/bob", headers=alice
    )
    assert response.status_code == 204

    # Bob should no longer be able to read.
    fetch = client.get(f"/api/boards/{board_id}", headers=bob)
    assert fetch.status_code == 404


def test_add_collaborator_for_unknown_user_returns_400(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = create_board(client, alice)
    response = client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "ghost", "role": "viewer"},
        headers=alice,
    )
    assert response.status_code == 400


def test_cannot_add_owner_as_collaborator(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = create_board(client, alice)
    response = client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "alice", "role": "editor"},
        headers=alice,
    )
    assert response.status_code == 400


def test_listing_collaborators_requires_access(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)
    response = client.get(
        f"/api/boards/{board_id}/collaborators", headers=bob
    )
    assert response.status_code == 404


def test_role_upgrade_replaces_existing_role(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    register(client, "bob")
    board_id = create_board(client, alice)
    client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "viewer"},
        headers=alice,
    )
    upgrade = client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": "bob", "role": "editor"},
        headers=alice,
    )
    assert upgrade.status_code == 201
    assert upgrade.json()["role"] == "editor"

    listed = client.get(
        f"/api/boards/{board_id}/collaborators", headers=alice
    ).json()
    assert len(listed["collaborators"]) == 1
    assert listed["collaborators"][0]["role"] == "editor"


# ---------------- Stats & export ----------------


def test_board_stats_counts_priority_overdue_columns_and_subtasks(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_with_subtasks = {
        "columns": [
            {"id": "todo", "title": "To do", "cardIds": ["c1", "c2"]},
            {"id": "done", "title": "Done", "cardIds": ["c3"]},
        ],
        "cards": {
            "c1": {
                "id": "c1",
                "title": "A",
                "details": "",
                "priority": "high",
                "dueDate": "2000-01-01",
                "subtasks": [
                    {"id": "s1", "title": "x", "done": True},
                    {"id": "s2", "title": "y", "done": False},
                ],
            },
            "c2": {
                "id": "c2",
                "title": "B",
                "details": "",
                "priority": "high",
                "dueDate": "2999-01-01",
            },
            "c3": {"id": "c3", "title": "C", "details": "", "priority": "low"},
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board_with_subtasks}, headers=alice
    )
    board_id = response.json()["id"]

    stats = client.get(f"/api/boards/{board_id}/stats", headers=alice).json()
    assert stats["total_cards"] == 3
    assert stats["total_columns"] == 2
    assert stats["by_priority"] == {"high": 2, "low": 1}
    assert stats["by_column"] == {"To do": 2, "Done": 1}
    assert stats["overdue_count"] == 1
    assert stats["with_due_date"] == 2
    assert stats["subtasks"] == {"done": 1, "total": 2}


def test_board_stats_requires_access(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)
    response = client.get(f"/api/boards/{board_id}/stats", headers=bob)
    assert response.status_code == 404


def test_export_returns_attachment_json(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = create_board(client, alice, name="Roadmap")
    response = client.get(f"/api/boards/{board_id}/export", headers=alice)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "attachment" in response.headers["content-disposition"]
    body = response.json()
    assert body["name"] == "Roadmap"
    assert body["board"]["columns"][0]["title"] == "To do"


def test_export_requires_access(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = create_board(client, alice)
    response = client.get(f"/api/boards/{board_id}/export", headers=bob)
    assert response.status_code == 404
