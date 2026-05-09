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
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def make_board(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str = "Roadmap",
    cards: dict | None = None,
    columns: list | None = None,
) -> int:
    payload_board = {
        "columns": columns
        or [
            {
                "id": "col-1",
                "title": "To do",
                "cardIds": list((cards or {}).keys()),
            }
        ],
        "cards": cards or {},
    }
    response = client.post(
        "/api/boards",
        json={"name": name, "board": payload_board},
        headers=headers,
    )
    assert response.status_code == 201
    return int(response.json()["id"])


# ---------------- My Tasks ----------------


def test_my_tasks_returns_assigned_cards_across_boards(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")

    # Alice's own board with two assigned cards
    make_board(
        client,
        alice,
        name="A Board",
        cards={
            "c1": {
                "id": "c1",
                "title": "Alice task 1",
                "details": "",
                "assignee": "alice",
                "priority": "high",
                "dueDate": "2000-01-01",
            },
            "c2": {
                "id": "c2",
                "title": "Alice task 2 (no due)",
                "details": "",
                "assignee": "alice",
            },
            "c3": {
                "id": "c3",
                "title": "Bob's task",
                "details": "",
                "assignee": "bob",
            },
        },
    )

    # Bob owns a board, shares with alice as editor; one card assigned to alice
    bob_board = make_board(
        client,
        bob,
        name="B Board",
        cards={
            "x1": {
                "id": "x1",
                "title": "Cross-board task",
                "details": "",
                "assignee": "alice",
                "priority": "medium",
            },
            "x2": {
                "id": "x2",
                "title": "Archived assigned",
                "details": "",
                "assignee": "alice",
                "archived": True,
            },
        },
    )
    client.post(
        f"/api/boards/{bob_board}/collaborators",
        json={"username": "alice", "role": "editor"},
        headers=bob,
    )

    response = client.get("/api/users/me/tasks", headers=alice)
    assert response.status_code == 200
    data = response.json()
    titles = [task["title"] for task in data["tasks"]]

    # Three assigned cards (excluding archived and bob's task)
    assert sorted(titles) == sorted(
        ["Alice task 1", "Alice task 2 (no due)", "Cross-board task"]
    )

    # Overdue card should come first
    assert data["tasks"][0]["title"] == "Alice task 1"
    assert data["tasks"][0]["overdue"] is True
    assert data["tasks"][0]["board_name"] == "A Board"


def test_my_tasks_empty_for_user_with_no_assignments(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    make_board(client, alice, cards={})
    response = client.get("/api/users/me/tasks", headers=alice)
    assert response.status_code == 200
    assert response.json()["tasks"] == []


def test_my_tasks_requires_auth(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/users/me/tasks")
    assert response.status_code == 401


# ---------------- Duplicate ----------------


def test_duplicate_clones_a_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    source = make_board(
        client,
        alice,
        name="Original",
        cards={
            "c1": {
                "id": "c1",
                "title": "Card",
                "details": "",
                "priority": "high",
            }
        },
    )
    response = client.post(
        f"/api/boards/{source}/duplicate", headers=alice, json={}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Original (copy)"
    assert body["id"] != source
    assert body["board"]["cards"]["c1"]["title"] == "Card"


def test_duplicate_with_explicit_name(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    source = make_board(client, alice, name="Original")
    response = client.post(
        f"/api/boards/{source}/duplicate",
        headers=alice,
        json={"name": "Q3 fork"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Q3 fork"


def test_duplicate_unknown_board_returns_404(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post("/api/boards/9999/duplicate", headers=alice, json={})
    assert response.status_code == 404


def test_collaborator_can_duplicate_to_their_own_account(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    source = make_board(client, alice, name="Original")
    client.post(
        f"/api/boards/{source}/collaborators",
        json={"username": "bob", "role": "viewer"},
        headers=alice,
    )
    response = client.post(
        f"/api/boards/{source}/duplicate", headers=bob, json={"name": "Bob fork"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["owner"] == "bob"


# ---------------- Import ----------------


def test_import_creates_a_new_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    payload = {
        "name": "Imported plan",
        "board": {
            "columns": [
                {
                    "id": "col-1",
                    "title": "Backlog",
                    "cardIds": ["card-imported"],
                }
            ],
            "cards": {
                "card-imported": {
                    "id": "card-imported",
                    "title": "Imported card",
                    "details": "From export",
                    "priority": "high",
                }
            },
        },
    }
    response = client.post("/api/boards/import", json=payload, headers=alice)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Imported plan"
    assert (
        body["board"]["cards"]["card-imported"]["title"] == "Imported card"
    )

    # And the board appears in the user's list.
    listed = client.get("/api/boards", headers=alice).json()["boards"]
    assert any(b["name"] == "Imported plan" for b in listed)


def test_import_rejects_invalid_card_payload(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    payload = {
        "name": "Bad",
        "board": {
            "columns": [{"id": "c", "title": "T", "cardIds": ["card-x"]}],
            "cards": {
                "card-x": {
                    "id": "card-x",
                    "title": "T",
                    "details": "",
                    "priority": "soon",
                }
            },
        },
    }
    response = client.post("/api/boards/import", json=payload, headers=alice)
    assert response.status_code in {400, 422}


def test_import_with_default_name_when_omitted(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    payload = {
        "board": {
            "columns": [{"id": "c", "title": "T", "cardIds": []}],
            "cards": {},
        }
    }
    response = client.post("/api/boards/import", json=payload, headers=alice)
    assert response.status_code == 201
    assert response.json()["name"] == "Imported board"
