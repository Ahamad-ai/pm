from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app


def build_client(tmp_path: Path) -> TestClient:
    static_dir = tmp_path / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    (static_dir / "index.html").write_text("<html>ok</html>")
    return TestClient(create_app(static_dir=static_dir, db_path=tmp_path / "pm.sqlite3"))


def test_chat_rejects_empty_message(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post(
        "/api/chat", json={"message": "   "}, headers={"X-Username": "user"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "message is required"


def test_chat_requires_openrouter_key(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    client = build_client(tmp_path)
    response = client.post(
        "/api/chat", json={"message": "2+2"}, headers={"X-Username": "user"}
    )
    assert response.status_code == 500
    assert response.json()["detail"] == "OPENROUTER_API_KEY is not configured."


def test_chat_requires_user_header(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.post("/api/chat", json={"message": "2+2"})
    assert response.status_code == 401


def test_chat_persists_ai_board_update(tmp_path: Path, monkeypatch) -> None:
    async def fake_structured_chat(**kwargs):
        _ = kwargs
        return {
            "assistant_message": "Done. I moved one card.",
            "board_update": {
                "columns": [
                    {"id": "col-a", "title": "Backlog", "cardIds": ["card-1"]},
                ],
                "cards": {
                    "card-1": {
                        "id": "card-1",
                        "title": "Updated task",
                        "details": "Updated details",
                    }
                },
            },
        }

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "backend.app.main.request_structured_chat",
        fake_structured_chat,
    )
    client = build_client(tmp_path)

    response = client.post(
        "/api/chat",
        json={"message": "Update the board", "conversation_history": []},
        headers={"X-Username": "user"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["assistant_message"] == "Done. I moved one card."
    assert payload["board_updated"] is True
    assert payload["board"]["cards"]["card-1"]["title"] == "Updated task"

    board_response = client.get("/api/board", headers={"X-Username": "user"})
    assert board_response.status_code == 200
    assert board_response.json()["board"]["cards"]["card-1"]["title"] == "Updated task"


def test_chat_rejects_invalid_structured_output(tmp_path: Path, monkeypatch) -> None:
    async def invalid_structured_chat(**kwargs):
        _ = kwargs
        return {"assistant_message": 123, "board_update": "not-a-board"}

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(
        "backend.app.main.request_structured_chat",
        invalid_structured_chat,
    )
    client = build_client(tmp_path)
    response = client.post(
        "/api/chat",
        json={"message": "Hi", "conversation_history": []},
        headers={"X-Username": "user"},
    )
    assert response.status_code == 502
    assert response.json()["detail"] == (
        "OpenRouter response did not match required structured output."
    )


def test_chat_repairs_missing_cards_from_current_board(tmp_path: Path, monkeypatch) -> None:
    async def ai_missing_cards(**kwargs):
        _ = kwargs
        return {
            "assistant_message": "Moved a card.",
            "board_update": {
                "columns": [
                    {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"]},
                    {"id": "col-discovery", "title": "Discovery", "cardIds": []},
                    {"id": "col-progress", "title": "In Progress", "cardIds": []},
                    {"id": "col-review", "title": "Review", "cardIds": []},
                    {"id": "col-done", "title": "Done", "cardIds": ["card-2"]},
                ],
                "cards": {
                    "card-2": {
                        "id": "card-2",
                        "title": "Gather customer signals",
                        "details": "Review support tags, sales notes, and churn feedback.",
                    }
                },
            },
        }

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("backend.app.main.request_structured_chat", ai_missing_cards)
    client = build_client(tmp_path)

    response = client.post(
        "/api/chat",
        json={"message": "Move card", "conversation_history": []},
        headers={"X-Username": "user"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["board_updated"] is True
    assert payload["board"]["cards"]["card-1"]["title"] == "Align roadmap themes"


def test_chat_drops_unknown_card_references(tmp_path: Path, monkeypatch) -> None:
    async def ai_dangling_reference(**kwargs):
        _ = kwargs
        return {
            "assistant_message": "Updated board.",
            "board_update": {
                "columns": [
                    {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-999"]},
                    {"id": "col-discovery", "title": "Discovery", "cardIds": []},
                    {"id": "col-progress", "title": "In Progress", "cardIds": []},
                    {"id": "col-review", "title": "Review", "cardIds": []},
                    {"id": "col-done", "title": "Done", "cardIds": []},
                ],
                "cards": {},
            },
        }

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("backend.app.main.request_structured_chat", ai_dangling_reference)
    client = build_client(tmp_path)
    response = client.post(
        "/api/chat",
        json={"message": "Do board operations", "conversation_history": []},
        headers={"X-Username": "user"},
    )
    assert response.status_code == 200
    payload = response.json()
    backlog = next(
        column for column in payload["board"]["columns"] if column["id"] == "col-backlog"
    )
    assert backlog["cardIds"] == []


def test_chat_preserves_unspecified_columns(tmp_path: Path, monkeypatch) -> None:
    async def ai_partial_board_update(**kwargs):
        _ = kwargs
        return {
            "assistant_message": "Added card in Discovery.",
            "board_update": {
                "columns": [
                    {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-new"]}
                ],
                "cards": {
                    "card-new": {
                        "id": "card-new",
                        "title": "Test",
                        "details": "Also test",
                    }
                },
            },
        }

    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr("backend.app.main.request_structured_chat", ai_partial_board_update)
    client = build_client(tmp_path)

    response = client.post(
        "/api/chat",
        json={"message": "Add new card to discovery", "conversation_history": []},
        headers={"X-Username": "user"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["board_updated"] is True
    assert len(payload["board"]["columns"]) == 5
    discovery = next(
        column for column in payload["board"]["columns"] if column["id"] == "col-discovery"
    )
    assert "card-new" in discovery["cardIds"]
