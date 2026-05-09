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


def add_collaborator(
    client: TestClient,
    headers: dict[str, str],
    board_id: int,
    username: str,
    role: str,
) -> None:
    response = client.post(
        f"/api/boards/{board_id}/collaborators",
        json={"username": username, "role": role},
        headers=headers,
    )
    assert response.status_code == 201


def make_board_with_card(
    client: TestClient, headers: dict[str, str]
) -> int:
    board = {
        "columns": [{"id": "c-1", "title": "Todo", "cardIds": ["card-x"]}],
        "cards": {"card-x": {"id": "card-x", "title": "Card", "details": ""}},
    }
    response = client.post(
        "/api/boards", json={"name": "B", "board": board}, headers=headers
    )
    assert response.status_code == 201
    return int(response.json()["id"])


def post_comment(
    client: TestClient,
    headers: dict[str, str],
    board_id: int,
    body: str,
    author: str = "alice",
) -> None:
    """Add a comment to card-x by re-saving the board."""
    detail = client.get(f"/api/boards/{board_id}", headers=headers).json()
    board = detail["board"]
    card = board["cards"]["card-x"]
    comments = card.get("comments") or []
    comments.append(
        {
            "id": f"cm-{len(comments) + 1}",
            "author": author,
            "body": body,
        }
    )
    card["comments"] = comments
    response = client.put(
        f"/api/boards/{board_id}",
        json={"board": board},
        headers=headers,
    )
    assert response.status_code == 200


# ---------------- Notifications ----------------


def test_collaborator_add_creates_notification(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")

    response = client.get("/api/users/me/notifications", headers=bob)
    assert response.status_code == 200
    data = response.json()
    assert data["unread_count"] == 1
    notification = data["notifications"][0]
    assert notification["kind"] == "collaborator_added"
    assert notification["payload"]["actor"] == "alice"
    assert notification["payload"]["role"] == "editor"


def test_mention_in_comment_creates_notification(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")
    # Bob now needs to be notified when alice mentions him.
    post_comment(client, alice, board_id, "Hey @bob, take a look.")

    response = client.get("/api/users/me/notifications", headers=bob)
    data = response.json()
    kinds = [n["kind"] for n in data["notifications"]]
    assert "mention" in kinds
    mention = next(n for n in data["notifications"] if n["kind"] == "mention")
    assert mention["payload"]["actor"] == "alice"
    assert mention["payload"]["card_id"] == "card-x"


def test_mentioning_self_does_not_create_notification(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)
    post_comment(client, alice, board_id, "@alice note to self")

    response = client.get("/api/users/me/notifications", headers=alice)
    assert response.json()["unread_count"] == 0


def test_assignment_creates_notification_for_assignee(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")

    detail = client.get(f"/api/boards/{board_id}", headers=alice).json()
    board = detail["board"]
    board["cards"]["card-x"]["assignee"] = "bob"
    update = client.put(
        f"/api/boards/{board_id}",
        json={"board": board},
        headers=alice,
    )
    assert update.status_code == 200

    notifs = client.get("/api/users/me/notifications", headers=bob).json()
    kinds = [n["kind"] for n in notifs["notifications"]]
    assert "card_assigned" in kinds
    entry = next(n for n in notifs["notifications"] if n["kind"] == "card_assigned")
    assert entry["payload"]["actor"] == "alice"
    assert entry["payload"]["card_id"] == "card-x"
    assert entry["payload"]["card_title"] == "Card"
    assert entry["payload"]["column_title"] == "Todo"


def test_self_assignment_still_fires_notification(tmp_path: Path) -> None:
    """A user assigning a card to themselves gets a confirmation
    notification — useful in single-user / demo contexts."""
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)

    detail = client.get(f"/api/boards/{board_id}", headers=alice).json()
    board = detail["board"]
    board["cards"]["card-x"]["assignee"] = "alice"
    update = client.put(
        f"/api/boards/{board_id}",
        json={"board": board},
        headers=alice,
    )
    assert update.status_code == 200

    notifs = client.get("/api/users/me/notifications", headers=alice).json()
    kinds = [n["kind"] for n in notifs["notifications"]]
    assert "card_assigned" in kinds


def test_assignment_resolves_case_insensitively(tmp_path: Path) -> None:
    """Typing the assignee with different casing still finds the user."""
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)

    detail = client.get(f"/api/boards/{board_id}", headers=alice).json()
    board = detail["board"]
    board["cards"]["card-x"]["assignee"] = "Alice"  # capitalized
    update = client.put(
        f"/api/boards/{board_id}",
        json={"board": board},
        headers=alice,
    )
    assert update.status_code == 200

    notifs = client.get("/api/users/me/notifications", headers=alice).json()
    assert any(n["kind"] == "card_assigned" for n in notifs["notifications"])


def test_unchanged_assignment_creates_no_notification(tmp_path: Path) -> None:
    """Re-saving a board without changing the assignee should not produce
    a duplicate notification."""
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")

    detail = client.get(f"/api/boards/{board_id}", headers=alice).json()
    board = detail["board"]
    board["cards"]["card-x"]["assignee"] = "bob"
    client.put(f"/api/boards/{board_id}", json={"board": board}, headers=alice)

    # Save again without changing assignee — should not create another.
    detail2 = client.get(f"/api/boards/{board_id}", headers=alice).json()
    client.put(
        f"/api/boards/{board_id}",
        json={"board": detail2["board"]},
        headers=alice,
    )

    bob_notifs = client.get("/api/users/me/notifications", headers=bob).json()
    assigned = [n for n in bob_notifs["notifications"] if n["kind"] == "card_assigned"]
    assert len(assigned) == 1


def test_assignment_to_unknown_user_is_ignored(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)

    detail = client.get(f"/api/boards/{board_id}", headers=alice).json()
    board = detail["board"]
    board["cards"]["card-x"]["assignee"] = "ghost"
    client.put(f"/api/boards/{board_id}", json={"board": board}, headers=alice)

    notifs = client.get("/api/users/me/notifications", headers=alice).json()
    assert all(n["kind"] != "card_assigned" for n in notifs["notifications"])


def test_unknown_mentioned_user_is_ignored(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)
    post_comment(client, alice, board_id, "Hello @ghost123")

    response = client.get("/api/users/me/notifications", headers=alice)
    assert response.json()["unread_count"] == 0


def test_mark_one_notification_read(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")

    notifications = client.get(
        "/api/users/me/notifications", headers=bob
    ).json()
    notif_id = notifications["notifications"][0]["id"]

    response = client.post(
        f"/api/users/me/notifications/{notif_id}/read", headers=bob
    )
    assert response.status_code == 200
    assert response.json()["unread_count"] == 0


def test_mark_all_notifications_read(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")
    post_comment(client, alice, board_id, "Hi @bob")

    response = client.post(
        "/api/users/me/notifications/read-all", headers=bob
    )
    assert response.status_code == 200
    body = response.json()
    assert body["unread_count"] == 0
    assert body["marked"] >= 2


def test_notification_endpoint_requires_auth(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/users/me/notifications")
    assert response.status_code == 401


def test_only_unread_filter_works(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")
    notifications = client.get(
        "/api/users/me/notifications", headers=bob
    ).json()["notifications"]
    notif_id = notifications[0]["id"]
    client.post(f"/api/users/me/notifications/{notif_id}/read", headers=bob)

    response = client.get(
        "/api/users/me/notifications?only_unread=true", headers=bob
    )
    assert response.json()["notifications"] == []


# ---------------- Public share links ----------------


def test_owner_can_enable_share_link(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)

    response = client.post(f"/api/boards/{board_id}/share", headers=alice)
    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["url"].startswith("/share?token=")


def test_non_owner_cannot_enable_share_link(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    bob = register(client, "bob")
    board_id = make_board_with_card(client, alice)
    add_collaborator(client, alice, board_id, "bob", "editor")

    response = client.post(f"/api/boards/{board_id}/share", headers=bob)
    assert response.status_code == 403


def test_enable_is_idempotent_returns_same_token(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)
    first = client.post(f"/api/boards/{board_id}/share", headers=alice).json()
    second = client.post(f"/api/boards/{board_id}/share", headers=alice).json()
    assert first["token"] == second["token"]


def test_public_board_endpoint_no_auth_required(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)
    token = client.post(f"/api/boards/{board_id}/share", headers=alice).json()[
        "token"
    ]

    response = client.get(f"/api/public/boards/{token}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "B"
    assert body["owner"] == "alice"
    assert "card-x" in body["board"]["cards"]


def test_public_board_unknown_token_returns_404(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    response = client.get("/api/public/boards/not-a-real-token")
    assert response.status_code == 404


def test_disable_share_link_makes_token_invalid(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)
    token = client.post(f"/api/boards/{board_id}/share", headers=alice).json()[
        "token"
    ]
    delete = client.delete(f"/api/boards/{board_id}/share", headers=alice)
    assert delete.status_code == 204

    public = client.get(f"/api/public/boards/{token}")
    assert public.status_code == 404


def test_get_share_link_returns_no_token_when_disabled(tmp_path: Path) -> None:
    client = build_client(tmp_path)
    alice = register(client, "alice")
    board_id = make_board_with_card(client, alice)
    response = client.get(f"/api/boards/{board_id}/share", headers=alice)
    assert response.status_code == 200
    assert response.json().get("token") in (None, "")
