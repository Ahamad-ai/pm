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


def test_persists_linked_card_ids(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    board = {
        "columns": [
            {"id": "col-1", "title": "Todo", "cardIds": ["c1", "c2", "c3"]},
        ],
        "cards": {
            "c1": {
                "id": "c1",
                "title": "Parent",
                "details": "",
                "linkedCardIds": ["c2", "c3"],
            },
            "c2": {"id": "c2", "title": "Child A", "details": ""},
            "c3": {"id": "c3", "title": "Child B", "details": ""},
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code == 201
    persisted = response.json()["board"]["cards"]["c1"]
    assert persisted["linkedCardIds"] == ["c2", "c3"]


def test_rejects_self_link(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    response = client.post(
        "/api/boards",
        json={
            "name": "B",
            "board": {
                "columns": [{"id": "c", "title": "T", "cardIds": ["c1"]}],
                "cards": {
                    "c1": {
                        "id": "c1",
                        "title": "Card",
                        "details": "",
                        "linkedCardIds": ["c1"],
                    }
                },
            },
        },
        headers=headers,
    )
    assert response.status_code in {400, 422}


def test_drops_links_to_missing_cards(tmp_path: Path) -> None:
    """If a card references an id that doesn't exist as a card, the link is
    silently dropped — same approach as the AI patch merger uses."""
    client = build_client(tmp_path)
    headers = register(client, "alice")
    response = client.post(
        "/api/boards",
        json={
            "name": "B",
            "board": {
                "columns": [{"id": "c", "title": "T", "cardIds": ["c1"]}],
                "cards": {
                    "c1": {
                        "id": "c1",
                        "title": "Card",
                        "details": "",
                        "linkedCardIds": ["c1-ghost", "c1-also-ghost"],
                    }
                },
            },
        },
        headers=headers,
    )
    assert response.status_code == 201
    body = response.json()
    # Both links pointed at nothing — the field should be dropped.
    assert "linkedCardIds" not in body["board"]["cards"]["c1"]


def test_dedupes_duplicate_links(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    response = client.post(
        "/api/boards",
        json={
            "name": "B",
            "board": {
                "columns": [{"id": "c", "title": "T", "cardIds": ["c1", "c2"]}],
                "cards": {
                    "c1": {
                        "id": "c1",
                        "title": "Card",
                        "details": "",
                        "linkedCardIds": ["c2", "c2", "c2"],
                    },
                    "c2": {"id": "c2", "title": "Other", "details": ""},
                },
            },
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert response.json()["board"]["cards"]["c1"]["linkedCardIds"] == ["c2"]


def test_rejects_non_string_link_entry(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    response = client.post(
        "/api/boards",
        json={
            "name": "B",
            "board": {
                "columns": [{"id": "c", "title": "T", "cardIds": ["c1"]}],
                "cards": {
                    "c1": {
                        "id": "c1",
                        "title": "Card",
                        "details": "",
                        "linkedCardIds": [123],
                    }
                },
            },
        },
        headers=headers,
    )
    assert response.status_code in {400, 422}


def test_link_survives_round_trip_via_put(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    initial = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["c1", "c2"]}],
        "cards": {
            "c1": {"id": "c1", "title": "A", "details": ""},
            "c2": {"id": "c2", "title": "B", "details": ""},
        },
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": initial}, headers=headers
    )
    board_id = response.json()["id"]
    body = response.json()["board"]
    body["cards"]["c1"]["linkedCardIds"] = ["c2"]
    update = client.put(
        f"/api/boards/{board_id}", json={"board": body}, headers=headers
    )
    assert update.status_code == 200
    assert update.json()["board"]["cards"]["c1"]["linkedCardIds"] == ["c2"]
