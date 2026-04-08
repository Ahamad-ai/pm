import sqlite3
from pathlib import Path

import pytest

from backend.app.db import (
    get_board_for_user,
    initialize_db,
    upsert_board_for_user,
)

VALID_BOARD = {
    "columns": [{"id": "col-a", "title": "Backlog", "cardIds": ["card-1"]}],
    "cards": {"card-1": {"id": "card-1", "title": "Task", "details": "Do this"}},
}


def test_initialize_db_creates_file_and_tables(tmp_path: Path) -> None:
    db_path = tmp_path / "data" / "pm.sqlite3"
    initialize_db(db_path)

    assert db_path.exists()

    with sqlite3.connect(db_path) as connection:
        users = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
        ).fetchone()
        boards = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'boards'"
        ).fetchone()
        assert users is not None
        assert boards is not None


def test_upsert_and_get_board_round_trip(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    upsert_board_for_user("user", VALID_BOARD, db_path)

    loaded = get_board_for_user("user", db_path)
    assert loaded == VALID_BOARD


def test_upsert_replaces_existing_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    upsert_board_for_user("user", VALID_BOARD, db_path)

    updated_board = {
        "columns": [{"id": "col-a", "title": "Done", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "Task", "details": "Complete"}},
    }
    upsert_board_for_user("user", updated_board, db_path)

    loaded = get_board_for_user("user", db_path)
    assert loaded == updated_board


def test_get_board_returns_none_for_missing_user(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_db(db_path)

    assert get_board_for_user("missing-user", db_path) is None


def test_upsert_rejects_invalid_board_payload(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    invalid_board = {"columns": [], "cards": {"card-1": {"id": "card-2"}}}

    with pytest.raises(ValueError):
        upsert_board_for_user("user", invalid_board, db_path)


def test_get_board_rejects_malformed_json_at_boundary(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initialize_db(db_path)
    with sqlite3.connect(db_path) as connection:
        cursor = connection.execute("INSERT INTO users(username) VALUES (?)", ("user",))
        connection.execute(
            "INSERT INTO boards(user_id, board_json) VALUES (?, ?)",
            (cursor.lastrowid, "{not-json"),
        )
        connection.commit()

    with pytest.raises(ValueError):
        get_board_for_user("user", db_path)
