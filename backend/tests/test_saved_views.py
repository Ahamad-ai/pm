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


def make_board_with_views(
    client: TestClient, headers: dict[str, str], views: list
) -> int:
    response = client.post(
        "/api/boards",
        json={
            "name": "Roadmap",
            "board": {
                "columns": [],
                "cards": {},
                "views": views,
            },
        },
        headers=headers,
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def test_persists_saved_view_with_full_filter(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    view = {
        "id": "v-1",
        "name": "My urgent",
        "filter": {
            "query": "ship",
            "priorities": ["urgent", "high"],
            "labels": ["release"],
            "assignees": ["alice"],
            "overdueOnly": True,
        },
    }
    board_id = make_board_with_views(client, alice, [view])

    fetched = client.get(f"/api/boards/{board_id}", headers=alice).json()
    views = fetched["board"]["views"]
    assert len(views) == 1
    assert views[0]["name"] == "My urgent"
    assert views[0]["filter"]["priorities"] == ["urgent", "high"]
    assert views[0]["filter"]["overdueOnly"] is True


def test_rejects_unknown_priority_in_view(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post(
        "/api/boards",
        json={
            "name": "B",
            "board": {
                "columns": [],
                "cards": {},
                "views": [
                    {
                        "id": "v-1",
                        "name": "Bad",
                        "filter": {"priorities": ["someday"]},
                    }
                ],
            },
        },
        headers=alice,
    )
    assert response.status_code in {400, 422}


def test_rejects_blank_view_name(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post(
        "/api/boards",
        json={
            "name": "B",
            "board": {
                "columns": [],
                "cards": {},
                "views": [
                    {"id": "v-1", "name": "  ", "filter": {}}
                ],
            },
        },
        headers=alice,
    )
    assert response.status_code in {400, 422}


def test_rejects_duplicate_view_ids(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    response = client.post(
        "/api/boards",
        json={
            "name": "B",
            "board": {
                "columns": [],
                "cards": {},
                "views": [
                    {"id": "v-1", "name": "A", "filter": {}},
                    {"id": "v-1", "name": "B", "filter": {}},
                ],
            },
        },
        headers=alice,
    )
    assert response.status_code in {400, 422}


def test_can_update_views_via_put(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_views(client, alice, [])
    fetched = client.get(f"/api/boards/{board_id}", headers=alice).json()
    board_payload = fetched["board"]
    board_payload["views"] = [
        {
            "id": "v-2",
            "name": "Bugs only",
            "filter": {"labels": ["bug"]},
        }
    ]
    response = client.put(
        f"/api/boards/{board_id}",
        json={"board": board_payload},
        headers=alice,
    )
    assert response.status_code == 200
    assert response.json()["board"]["views"][0]["name"] == "Bugs only"
