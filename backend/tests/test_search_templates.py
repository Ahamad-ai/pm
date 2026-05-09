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
    name: str,
    cards: dict | None = None,
) -> int:
    payload = {
        "columns": [
            {
                "id": "col-1",
                "title": "Todo",
                "cardIds": list((cards or {}).keys()),
            }
        ],
        "cards": cards or {},
    }
    response = client.post(
        "/api/boards",
        json={"name": name, "board": payload},
        headers=headers,
    )
    assert response.status_code == 201
    return int(response.json()["id"])


# ---------------- Search ----------------


def test_search_finds_card_by_title(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    make_board(
        client,
        alice,
        name="Roadmap",
        cards={
            "c1": {"id": "c1", "title": "Refactor pricing model", "details": ""},
            "c2": {"id": "c2", "title": "Other thing", "details": ""},
        },
    )
    response = client.get("/api/search?q=pricing", headers=alice)
    assert response.status_code == 200
    body = response.json()
    titles = [card["title"] for card in body["cards"]]
    assert titles == ["Refactor pricing model"]


def test_search_finds_board_by_name(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    make_board(client, alice, name="Pricing", cards={})
    make_board(client, alice, name="Other", cards={})
    response = client.get("/api/search?q=pric", headers=alice)
    assert response.status_code == 200
    boards = response.json()["boards"]
    assert [b["name"] for b in boards] == ["Pricing"]


def test_search_matches_labels_and_comments(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    make_board(
        client,
        alice,
        name="B",
        cards={
            "c1": {
                "id": "c1",
                "title": "Card",
                "details": "",
                "labels": ["urgent-fix"],
                "comments": [
                    {"id": "cm-1", "author": "alice", "body": "elephants here"}
                ],
            }
        },
    )
    by_label = client.get("/api/search?q=urgent-fix", headers=alice).json()
    assert any(c["card_id"] == "c1" for c in by_label["cards"])

    by_comment = client.get("/api/search?q=elephant", headers=alice).json()
    assert any(c["card_id"] == "c1" for c in by_comment["cards"])


def test_search_excludes_archived_cards(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    make_board(
        client,
        alice,
        name="B",
        cards={
            "c1": {"id": "c1", "title": "Pinky", "details": "", "archived": True},
        },
    )
    response = client.get("/api/search?q=pinky", headers=alice).json()
    assert response["cards"] == []


def test_search_only_returns_user_accessible_boards(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    make_board(
        client,
        bob,
        name="Bob's secrets",
        cards={"c1": {"id": "c1", "title": "Top secret", "details": ""}},
    )
    response = client.get("/api/search?q=secret", headers=alice).json()
    assert response["boards"] == []
    assert response["cards"] == []


def test_search_empty_query_returns_empty(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    make_board(client, alice, name="X", cards={})
    response = client.get("/api/search?q=", headers=alice).json()
    assert response["boards"] == []
    assert response["cards"] == []


def test_search_requires_auth(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/search?q=anything")
    assert response.status_code == 401


# ---------------- Templates ----------------


def test_list_templates_returns_known_set(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.get("/api/templates", headers=alice)
    assert response.status_code == 200
    ids = {t["id"] for t in response.json()["templates"]}
    assert {"kanban", "scrum", "personal", "okr", "bug-tracker"} <= ids


def test_create_board_from_kanban_template(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post(
        "/api/boards/from-template/kanban", headers=alice, json={}
    )
    assert response.status_code == 201
    body = response.json()
    titles = [column["title"] for column in body["board"]["columns"]]
    assert titles == ["Backlog", "In Progress", "Review", "Done"]
    # Default name from template
    assert body["name"] == "Kanban board"


def test_create_board_from_template_with_custom_name(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post(
        "/api/boards/from-template/scrum",
        headers=alice,
        json={"name": "Q3 sprint"},
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Q3 sprint"


def test_create_from_unknown_template_returns_404(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post(
        "/api/boards/from-template/does-not-exist", headers=alice, json={}
    )
    assert response.status_code == 404


def test_template_contains_wip_limit_passthrough(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post(
        "/api/boards/from-template/scrum", headers=alice, json={}
    )
    assert response.status_code == 201
    columns = response.json()["board"]["columns"]
    progress = next(c for c in columns if c["title"] == "In Progress")
    assert progress["wipLimit"] == 3
