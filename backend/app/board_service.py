from copy import deepcopy
from pathlib import Path
from typing import Any

from backend.app.db import DEFAULT_DB_PATH, get_board_for_user, upsert_board_for_user
from backend.app.default_board import DEFAULT_BOARD


def get_or_create_board_for_user(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any]:
    board = get_board_for_user(username, db_path)
    if board is not None:
        return board

    seeded = deepcopy(DEFAULT_BOARD)
    upsert_board_for_user(username, seeded, db_path)
    return seeded


def save_board_for_user(
    username: str, board: dict[str, Any], db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any]:
    upsert_board_for_user(username, board, db_path)
    stored = get_board_for_user(username, db_path)
    if stored is None:
        raise RuntimeError("board save failed unexpectedly")
    return stored
