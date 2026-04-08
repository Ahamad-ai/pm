from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app

VALID_BOARD = {
    "columns": [{"id": "col-a", "title": "Backlog", "cardIds": ["card-1"]}],
    "cards": {"card-1": {"id": "card-1", "title": "Task", "details": "Do this"}},
}


def build_client(tmp_path: Path) -> TestClient:
    static_dir = tmp_path / "static"
    static_dir.mkdir(parents=True, exist_ok=True)
    (static_dir / "index.html").write_text("<html>ok</html>")
    return TestClient(create_app(static_dir=static_dir, db_path=tmp_path / "pm.sqlite3"))


def test_get_board_requires_user_header(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/board")
    assert response.status_code == 401


def test_get_board_seeds_default_for_new_user(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/board", headers={"X-Username": "user"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "user"
    assert isinstance(payload["board"]["columns"], list)
    assert isinstance(payload["board"]["cards"], dict)
    assert len(payload["board"]["columns"]) == 5


def test_put_board_persists_for_user(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    put_response = client.put(
        "/api/board", json=VALID_BOARD, headers={"X-Username": "user"}
    )
    assert put_response.status_code == 200
    assert put_response.json()["board"] == VALID_BOARD

    # New client instance over same SQLite file simulates API restart persistence.
    restart_client = build_client(tmp_path)
    get_response = restart_client.get("/api/board", headers={"X-Username": "user"})
    assert get_response.status_code == 200
    assert get_response.json()["board"] == VALID_BOARD


def test_put_board_rejects_invalid_payload(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    invalid_payload = {"columns": [], "cards": {"card-1": {"id": "card-x"}}}
    response = client.put(
        "/api/board", json=invalid_payload, headers={"X-Username": "user"}
    )
    assert response.status_code == 422


def test_put_board_requires_user_header(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.put("/api/board", json=VALID_BOARD)
    assert response.status_code == 401
