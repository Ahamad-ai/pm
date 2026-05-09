from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


SIMPLE_BOARD = {
    "columns": [{"id": "col-1", "title": "To do", "cardIds": ["card-1"]}],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Write tests",
            "details": "Cover the new endpoints",
            "priority": "high",
            "labels": ["backend", "tests"],
            "dueDate": "2026-06-01",
            "assignee": "alice",
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


def auth_headers(client: TestClient, username: str = "alice") -> dict[str, str]:
    register = client.post(
        "/api/register",
        json={"username": username, "password": "secret123"},
    )
    assert register.status_code == 201
    token = register.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_boards_for_new_user_is_empty(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    response = client.get("/api/boards", headers=headers)
    assert response.status_code == 200
    assert response.json()["boards"] == []


def test_create_board_returns_summary(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    response = client.post(
        "/api/boards",
        json={"name": "Roadmap", "board": SIMPLE_BOARD},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Roadmap"
    assert body["board"]["columns"][0]["title"] == "To do"
    assert body["board"]["cards"]["card-1"]["priority"] == "high"
    assert body["board"]["cards"]["card-1"]["labels"] == ["backend", "tests"]


def test_user_can_have_multiple_boards(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    client.post("/api/boards", json={"name": "Board A"}, headers=headers)
    client.post("/api/boards", json={"name": "Board B"}, headers=headers)

    response = client.get("/api/boards", headers=headers)
    assert response.status_code == 200
    boards = response.json()["boards"]
    assert [b["name"] for b in boards] == ["Board A", "Board B"]
    # Positions are auto-assigned in insert order.
    assert boards[0]["position"] == 0
    assert boards[1]["position"] == 1


def test_get_specific_board_by_id(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    created = client.post(
        "/api/boards",
        json={"name": "Roadmap", "board": SIMPLE_BOARD},
        headers=headers,
    ).json()
    board_id = created["id"]

    fetched = client.get(f"/api/boards/{board_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Roadmap"
    assert fetched.json()["board"] == SIMPLE_BOARD


def test_get_unknown_board_returns_404(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    response = client.get("/api/boards/9999", headers=headers)
    assert response.status_code == 404


def test_user_cannot_access_another_users_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice_headers = auth_headers(client, "alice")
    bob_headers = auth_headers(client, "bob")

    alice_board = client.post(
        "/api/boards",
        json={"name": "Alice secret", "board": SIMPLE_BOARD},
        headers=alice_headers,
    ).json()

    response = client.get(
        f"/api/boards/{alice_board['id']}", headers=bob_headers
    )
    assert response.status_code == 404


def test_update_board_renames_and_replaces_data(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    created = client.post(
        "/api/boards",
        json={"name": "Roadmap", "board": SIMPLE_BOARD},
        headers=headers,
    ).json()
    board_id = created["id"]

    next_board = {
        "columns": [{"id": "col-2", "title": "Done", "cardIds": []}],
        "cards": {},
    }
    response = client.put(
        f"/api/boards/{board_id}",
        json={"name": "Q3 Roadmap", "board": next_board},
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Q3 Roadmap"
    assert body["board"] == next_board


def test_update_board_requires_name_or_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    created = client.post(
        "/api/boards",
        json={"name": "Roadmap", "board": SIMPLE_BOARD},
        headers=headers,
    ).json()
    response = client.put(
        f"/api/boards/{created['id']}", json={}, headers=headers
    )
    assert response.status_code == 400


def test_delete_board(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    created = client.post(
        "/api/boards", json={"name": "Roadmap"}, headers=headers
    ).json()
    board_id = created["id"]

    delete = client.delete(f"/api/boards/{board_id}", headers=headers)
    assert delete.status_code == 204

    fetch = client.get(f"/api/boards/{board_id}", headers=headers)
    assert fetch.status_code == 404


def test_delete_unknown_board_returns_404(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    response = client.delete("/api/boards/9999", headers=headers)
    assert response.status_code == 404


def test_create_board_rejects_invalid_card_priority(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    bad_board = {
        "columns": [{"id": "c-1", "title": "T", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Task",
                "details": "",
                "priority": "later",
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "Bad", "board": bad_board}, headers=headers
    )
    assert response.status_code == 422


def test_create_board_rejects_invalid_due_date(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    bad_board = {
        "columns": [{"id": "c-1", "title": "T", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Task",
                "details": "",
                "dueDate": "next friday",
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "Bad", "board": bad_board}, headers=headers
    )
    assert response.status_code == 400


def test_board_endpoints_require_auth(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    assert client.get("/api/boards").status_code == 401
    assert client.post("/api/boards", json={"name": "X"}).status_code == 401
    assert client.get("/api/boards/1").status_code == 401
    assert (
        client.put("/api/boards/1", json={"name": "Z"}).status_code == 401
    )
    assert client.delete("/api/boards/1").status_code == 401


def test_activity_log_records_creation_and_updates(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    created = client.post(
        "/api/boards",
        json={"name": "Roadmap", "board": SIMPLE_BOARD},
        headers=headers,
    ).json()
    board_id = created["id"]

    next_board = {
        "columns": [{"id": "c-2", "title": "Done", "cardIds": []}],
        "cards": {},
    }
    client.put(
        f"/api/boards/{board_id}",
        json={"name": "Renamed", "board": next_board},
        headers=headers,
    )

    response = client.get(f"/api/boards/{board_id}/activity", headers=headers)
    assert response.status_code == 200
    actions = [entry["action"] for entry in response.json()["entries"]]
    # Newest first.
    assert "board.created" in actions
    assert "board.renamed" in actions
    assert "board.updated" in actions


def test_create_board_persists_subtasks(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    board_with_subtasks = {
        "columns": [{"id": "c-1", "title": "Todo", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Ship feature",
                "details": "",
                "subtasks": [
                    {"id": "s-1", "title": "Write tests", "done": True},
                    {"id": "s-2", "title": "Update docs", "done": False},
                ],
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board_with_subtasks}, headers=headers
    )
    assert response.status_code == 201
    card = response.json()["board"]["cards"]["card-x"]
    assert len(card["subtasks"]) == 2
    assert card["subtasks"][0]["done"] is True


def test_create_board_rejects_invalid_subtask(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    bad_board = {
        "columns": [{"id": "c-1", "title": "Todo", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Task",
                "details": "",
                "subtasks": [{"id": "", "title": "Bad", "done": False}],
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": bad_board}, headers=headers
    )
    assert response.status_code in {400, 422}


def test_create_board_rejects_duplicate_subtask_ids(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    bad_board = {
        "columns": [{"id": "c-1", "title": "Todo", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Task",
                "details": "",
                "subtasks": [
                    {"id": "s-1", "title": "A", "done": False},
                    {"id": "s-1", "title": "B", "done": False},
                ],
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": bad_board}, headers=headers
    )
    assert response.status_code in {400, 422}


def test_create_board_persists_comments(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    board = {
        "columns": [{"id": "c-1", "title": "Todo", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Card",
                "details": "",
                "comments": [
                    {
                        "id": "cm-1",
                        "author": "alice",
                        "body": "Looks good",
                        "createdAt": "2026-05-09T10:00:00Z",
                    }
                ],
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code == 201
    persisted = response.json()["board"]["cards"]["card-x"]["comments"]
    assert len(persisted) == 1
    assert persisted[0]["author"] == "alice"
    assert persisted[0]["body"] == "Looks good"


def test_create_board_rejects_blank_comment_body(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    board = {
        "columns": [{"id": "c-1", "title": "Todo", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Card",
                "details": "",
                "comments": [
                    {"id": "cm-1", "author": "alice", "body": "   "}
                ],
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code in {400, 422}


def test_create_board_persists_wip_limit(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    board = {
        "columns": [
            {"id": "c-1", "title": "Todo", "cardIds": [], "wipLimit": 3}
        ],
        "cards": {},
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code == 201
    assert response.json()["board"]["columns"][0]["wipLimit"] == 3


def test_create_board_rejects_invalid_wip_limit(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    board = {
        "columns": [
            {"id": "c-1", "title": "Todo", "cardIds": [], "wipLimit": 0}
        ],
        "cards": {},
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code in {400, 422}


def test_create_board_persists_archived_flag(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    board = {
        "columns": [{"id": "c-1", "title": "Todo", "cardIds": ["card-x"]}],
        "cards": {
            "card-x": {
                "id": "card-x",
                "title": "Stale",
                "details": "",
                "archived": True,
            }
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code == 201
    assert response.json()["board"]["cards"]["card-x"]["archived"] is True


def test_archived_cards_excluded_from_stats(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = auth_headers(client)
    board = {
        "columns": [
            {"id": "c-1", "title": "Todo", "cardIds": ["c-active", "c-archived"]}
        ],
        "cards": {
            "c-active": {
                "id": "c-active",
                "title": "Active",
                "details": "",
                "priority": "high",
            },
            "c-archived": {
                "id": "c-archived",
                "title": "Archived",
                "details": "",
                "priority": "low",
                "archived": True,
            },
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code == 201
    board_id = response.json()["id"]
    stats = client.get(
        f"/api/boards/{board_id}/stats", headers=headers
    ).json()
    # Archived cards shouldn't pollute priority/overdue/totals.
    assert stats["total_cards"] == 1
    assert stats["by_priority"] == {"high": 1}


def test_activity_endpoint_requires_ownership(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice_headers = auth_headers(client, "alice")
    bob_headers = auth_headers(client, "bob")
    created = client.post(
        "/api/boards",
        json={"name": "Roadmap"},
        headers=alice_headers,
    ).json()
    response = client.get(
        f"/api/boards/{created['id']}/activity", headers=bob_headers
    )
    assert response.status_code == 404
