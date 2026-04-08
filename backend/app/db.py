import json
import sqlite3
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "pm.sqlite3"


def get_connection(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_db(db_path: Path | str = DEFAULT_DB_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL UNIQUE,
              board_json TEXT NOT NULL,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.commit()


def _ensure_user(connection: sqlite3.Connection, username: str) -> int:
    normalized_username = username.strip()
    if not normalized_username:
        raise ValueError("username is required")

    existing = connection.execute(
        "SELECT id FROM users WHERE username = ?", (normalized_username,)
    ).fetchone()
    if existing:
        return int(existing["id"])

    cursor = connection.execute(
        "INSERT INTO users(username) VALUES (?)", (normalized_username,)
    )
    return int(cursor.lastrowid)


def _validate_board_data(board: Any) -> dict[str, Any]:
    if not isinstance(board, dict):
        raise ValueError("board must be an object")

    columns = board.get("columns")
    cards = board.get("cards")
    if not isinstance(columns, list):
        raise ValueError("board.columns must be a list")
    if not isinstance(cards, dict):
        raise ValueError("board.cards must be an object")

    for column in columns:
        if not isinstance(column, dict):
            raise ValueError("column must be an object")
        if not isinstance(column.get("id"), str):
            raise ValueError("column.id must be a string")
        if not isinstance(column.get("title"), str):
            raise ValueError("column.title must be a string")
        card_ids = column.get("cardIds")
        if not isinstance(card_ids, list) or not all(
            isinstance(card_id, str) for card_id in card_ids
        ):
            raise ValueError("column.cardIds must be a list of strings")
        for card_id in card_ids:
            if card_id not in cards:
                raise ValueError(f"column references missing card id: {card_id}")

    for card_id, card in cards.items():
        if not isinstance(card_id, str):
            raise ValueError("card id must be a string")
        if not isinstance(card, dict):
            raise ValueError("card must be an object")
        if card.get("id") != card_id:
            raise ValueError("card.id must match card key")
        if not isinstance(card.get("title"), str):
            raise ValueError("card.title must be a string")
        if not isinstance(card.get("details"), str):
            raise ValueError("card.details must be a string")

    return {"columns": columns, "cards": cards}


def upsert_board_for_user(
    username: str, board: dict[str, Any], db_path: Path | str = DEFAULT_DB_PATH
) -> None:
    validated_board = _validate_board_data(board)
    initialize_db(db_path)

    with get_connection(db_path) as connection:
        user_id = _ensure_user(connection, username)
        payload = json.dumps(validated_board, separators=(",", ":"))
        connection.execute(
            """
            INSERT INTO boards(user_id, board_json)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              board_json = excluded.board_json,
              updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, payload),
        )
        connection.commit()


def get_board_for_user(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any] | None:
    initialize_db(db_path)
    with get_connection(db_path) as connection:
        row = connection.execute(
            """
            SELECT b.board_json
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE u.username = ?
            """,
            (username.strip(),),
        ).fetchone()
        if row is None:
            return None

        try:
            parsed = json.loads(str(row["board_json"]))
        except json.JSONDecodeError as exc:
            raise ValueError("stored board_json is invalid JSON") from exc
        return _validate_board_data(parsed)
