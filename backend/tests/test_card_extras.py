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


def post_board(
    client: TestClient,
    headers: dict[str, str],
    cards: dict,
) -> int:
    payload = {
        "name": "B",
        "board": {
            "columns": [
                {"id": "c", "title": "T", "cardIds": list(cards.keys())},
            ],
            "cards": cards,
        },
    }
    response = client.post("/api/boards", json=payload, headers=headers)
    return response.status_code, response.json()


# ---------------- Attachments ----------------


def test_attachments_round_trip(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, body = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "Card",
                "details": "",
                "attachments": [
                    {
                        "id": "a-1",
                        "label": "Spec",
                        "url": "https://example.com/spec",
                    }
                ],
            }
        },
    )
    assert code == 201
    persisted = body["board"]["cards"]["card-1"]["attachments"]
    assert len(persisted) == 1
    assert persisted[0]["url"] == "https://example.com/spec"


def test_rejects_non_http_attachment_url(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, _ = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "attachments": [
                    {"id": "a-1", "label": "Doc", "url": "javascript:alert(1)"}
                ],
            }
        },
    )
    assert code in (400, 422)


def test_rejects_blank_attachment_label(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, _ = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "attachments": [
                    {"id": "a-1", "label": "  ", "url": "https://x.test"}
                ],
            }
        },
    )
    assert code in (400, 422)


def test_rejects_duplicate_attachment_ids(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, _ = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "attachments": [
                    {"id": "a-1", "label": "A", "url": "https://x.test"},
                    {"id": "a-1", "label": "B", "url": "https://y.test"},
                ],
            }
        },
    )
    assert code in (400, 422)


# ---------------- Time entries ----------------


def test_time_entries_round_trip(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, body = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "timeEntries": [
                    {
                        "id": "t-1",
                        "startedAt": "2026-05-09T10:00:00Z",
                        "endedAt": "2026-05-09T10:30:00Z",
                        "seconds": 1800,
                    }
                ],
            }
        },
    )
    assert code == 201
    entries = body["board"]["cards"]["card-1"]["timeEntries"]
    assert entries[0]["seconds"] == 1800


def test_rejects_negative_seconds(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, _ = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "timeEntries": [
                    {
                        "id": "t-1",
                        "startedAt": "2026-05-09T10:00:00Z",
                        "endedAt": "2026-05-09T10:30:00Z",
                        "seconds": -10,
                    }
                ],
            }
        },
    )
    assert code in (400, 422)


def test_rejects_multiple_open_time_entries(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, _ = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "timeEntries": [
                    {"id": "t-1", "startedAt": "2026-05-09T10:00:00Z"},
                    {"id": "t-2", "startedAt": "2026-05-09T10:05:00Z"},
                ],
            }
        },
    )
    assert code in (400, 422)


def test_allows_one_open_entry(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, body = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "timeEntries": [
                    {
                        "id": "t-done",
                        "startedAt": "2026-05-09T09:00:00Z",
                        "endedAt": "2026-05-09T09:30:00Z",
                        "seconds": 1800,
                    },
                    {"id": "t-open", "startedAt": "2026-05-09T10:00:00Z"},
                ],
            }
        },
    )
    assert code == 201
    entries = body["board"]["cards"]["card-1"]["timeEntries"]
    assert any("endedAt" not in entry for entry in entries)


def test_rejects_duplicate_entry_ids(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    headers = register(client, "alice")
    code, _ = post_board(
        client,
        headers,
        {
            "card-1": {
                "id": "card-1",
                "title": "X",
                "details": "",
                "timeEntries": [
                    {
                        "id": "t-1",
                        "startedAt": "2026-05-09T10:00:00Z",
                        "endedAt": "2026-05-09T10:30:00Z",
                        "seconds": 1800,
                    },
                    {
                        "id": "t-1",
                        "startedAt": "2026-05-09T11:00:00Z",
                        "endedAt": "2026-05-09T11:30:00Z",
                        "seconds": 1800,
                    },
                ],
            }
        },
    )
    assert code in (400, 422)
