from copy import deepcopy
from pathlib import Path
from typing import Any

from backend.app.db import (
    DEFAULT_DB_PATH,
    create_board_for_user,
    get_board_for_user,
    get_board_for_user_by_id,
    list_boards_for_user,
    upsert_board_for_user,
)
from backend.app.default_board import DEFAULT_BOARD


def get_or_create_board_for_user(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any]:
    """Legacy single-board getter — used by the chat flow when no
    explicit board_id is provided. Seeds a default board on first call."""
    board = get_board_for_user(username, db_path)
    if board is not None:
        return board

    seeded = deepcopy(DEFAULT_BOARD)
    upsert_board_for_user(username, seeded, db_path)
    return seeded


def save_board_for_user(
    username: str, board: dict[str, Any], db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any]:
    return upsert_board_for_user(username, board, db_path)


def ensure_first_board_seeded(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> int:
    """Make sure the user has at least one board; returns its ID."""
    boards = list_boards_for_user(username, db_path)
    if boards:
        return int(boards[0]["id"])
    created = create_board_for_user(
        username=username,
        name="My Board",
        board=deepcopy(DEFAULT_BOARD),
        db_path=db_path,
    )
    return int(created["id"])


def resolve_board_for_chat(
    username: str,
    board_id: int | None,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> tuple[int, dict[str, Any]]:
    """Resolve which board to act on for a chat request.

    Returns (board_id, board_data). If `board_id` is given, the user must
    own it. Otherwise the user's first board is used (seeded if needed)."""
    if board_id is not None:
        record = get_board_for_user_by_id(username, board_id, db_path)
        if record is None:
            raise ValueError("board not found")
        return int(record["id"]), record["board"]

    seeded_board = get_or_create_board_for_user(username, db_path)
    boards = list_boards_for_user(username, db_path)
    resolved_id = int(boards[0]["id"]) if boards else ensure_first_board_seeded(username, db_path)
    return resolved_id, seeded_board
