from pathlib import Path

import pytest

from backend.app.board_service import get_or_create_board_for_user, save_board_for_user
from backend.app.default_board import DEFAULT_BOARD


def test_get_or_create_seeds_default_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    board = get_or_create_board_for_user("user", db_path)
    assert board == DEFAULT_BOARD


def test_get_or_create_returns_existing_board(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    initial = get_or_create_board_for_user("user", db_path)
    assert initial == DEFAULT_BOARD

    updated = {
        "columns": [{"id": "col-1", "title": "Custom", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "X", "details": "Y"}},
    }
    save_board_for_user("user", updated, db_path)

    loaded = get_or_create_board_for_user("user", db_path)
    assert loaded == updated


def test_save_board_rejects_invalid_payload(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    with pytest.raises(ValueError):
        save_board_for_user("user", {"columns": [], "cards": {"card-1": {}}}, db_path)
