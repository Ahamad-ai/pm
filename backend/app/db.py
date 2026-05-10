import hashlib
import hmac
import html
import json
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = PROJECT_ROOT / "data" / "pm.sqlite3"

MAX_COLUMN_TITLE_LEN = 100
MAX_CARD_TITLE_LEN = 200
MAX_CARD_DETAILS_LEN = 2000
MAX_BOARD_NAME_LEN = 80
MAX_LABEL_LEN = 40
MAX_LABELS_PER_CARD = 8
MAX_USERNAME_LEN = 60
MAX_DISPLAY_NAME_LEN = 80
MAX_SUBTASKS_PER_CARD = 50
MAX_SUBTASK_TITLE_LEN = 200
MAX_COMMENTS_PER_CARD = 200
MAX_COMMENT_BODY_LEN = 2000
MAX_WIP_LIMIT = 100
MAX_ATTACHMENTS_PER_CARD = 30
MAX_ATTACHMENT_LABEL_LEN = 80
MAX_ATTACHMENT_URL_LEN = 1000
MAX_TIME_ENTRIES_PER_CARD = 200
MAX_OPEN_TIME_ENTRIES_PER_CARD = 1
MAX_TIME_ENTRY_SECONDS = 60 * 60 * 24 * 365

ALLOWED_PRIORITIES = {"low", "medium", "high", "urgent"}

SCRYPT_N = 2 ** 14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 64


def _sanitize_string(value: str, max_length: int) -> str:
    return html.escape(value[:max_length])


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _safe_json_loads(value: Any) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _column_title_by_card_id(board: dict[str, Any]) -> dict[str, str]:
    """Return a card_id -> column.title lookup for the given board."""
    return {
        card_id: column["title"]
        for column in board["columns"]
        for card_id in column["cardIds"]
    }


def get_connection(db_path: Path | str = DEFAULT_DB_PATH) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _table_columns(connection: sqlite3.Connection, table: str) -> list[str]:
    rows = connection.execute(f"PRAGMA table_info({table})").fetchall()
    return [row["name"] for row in rows]


def _has_unique_index_on_user_id(connection: sqlite3.Connection) -> bool:
    for index in connection.execute("PRAGMA index_list(boards)").fetchall():
        if not index["unique"]:
            continue
        info = connection.execute(f"PRAGMA index_info({index['name']})").fetchall()
        if [row["name"] for row in info] == ["user_id"]:
            return True
    return False


def _migrate_boards_table(connection: sqlite3.Connection) -> None:
    """Migrate legacy `boards` (one-per-user, UNIQUE user_id) to the
    multi-board schema. Idempotent — runs only when needed."""
    existing_cols = _table_columns(connection, "boards")
    needs_rewrite = (
        "name" not in existing_cols
        or "created_at" not in existing_cols
        or _has_unique_index_on_user_id(connection)
    )
    if not needs_rewrite:
        return

    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS boards_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          board_json TEXT NOT NULL,
          position INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    if "board_json" in existing_cols:
        select_cols = "id, user_id, board_json"
        if "updated_at" in existing_cols:
            select_cols += ", updated_at"
            connection.execute(
                """
                INSERT INTO boards_new(id, user_id, name, board_json, position, created_at, updated_at)
                SELECT id, user_id, 'My Board', board_json, 0, updated_at, updated_at
                FROM boards
                """
            )
        else:
            connection.execute(
                """
                INSERT INTO boards_new(id, user_id, name, board_json, position)
                SELECT id, user_id, 'My Board', board_json, 0
                FROM boards
                """
            )
    connection.execute("DROP TABLE IF EXISTS boards")
    connection.execute("ALTER TABLE boards_new RENAME TO boards")


def _migrate_users_table(connection: sqlite3.Connection) -> None:
    """Add password_hash, display_name, role, created_at columns to users
    if they don't yet exist. SQLite forbids non-constant defaults on
    ALTER TABLE ADD COLUMN, so we add nullable columns then backfill."""
    existing_cols = _table_columns(connection, "users")
    if "password_hash" not in existing_cols:
        connection.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "display_name" not in existing_cols:
        connection.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
    if "role" not in existing_cols:
        connection.execute("ALTER TABLE users ADD COLUMN role TEXT")
        connection.execute("UPDATE users SET role = 'member' WHERE role IS NULL")
    if "created_at" not in existing_cols:
        connection.execute("ALTER TABLE users ADD COLUMN created_at TEXT")
        connection.execute(
            "UPDATE users SET created_at = ? WHERE created_at IS NULL",
            (_now_iso(),),
        )


def initialize_db(db_path: Path | str = DEFAULT_DB_PATH) -> None:
    with get_connection(db_path) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT,
              display_name TEXT,
              role TEXT NOT NULL DEFAULT 'member',
              created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        _migrate_users_table(connection)
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              board_json TEXT NOT NULL,
              position INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        _migrate_boards_table(connection)
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS activity_log (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              board_id INTEGER NOT NULL,
              action TEXT NOT NULL,
              details TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS board_collaborators (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              board_id INTEGER NOT NULL,
              user_id INTEGER NOT NULL,
              role TEXT NOT NULL CHECK (role IN ('viewer', 'editor')),
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE(board_id, user_id),
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              kind TEXT NOT NULL,
              board_id INTEGER,
              payload TEXT,
              read_at TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS pinned_boards (
              user_id INTEGER NOT NULL,
              board_id INTEGER NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              PRIMARY KEY (user_id, board_id),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS board_share_tokens (
              board_id INTEGER PRIMARY KEY,
              token TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_activity_board ON activity_log(board_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_collab_user ON board_collaborators(user_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at, id)"
        )
        connection.commit()


# ---------------- Password hashing (stdlib scrypt) ----------------


def hash_password(password: str) -> str:
    if not isinstance(password, str) or len(password) < 6:
        raise ValueError("password must be at least 6 characters")
    if len(password) > 256:
        raise ValueError("password is too long")
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_DKLEN,
    )
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str | None) -> bool:
    if not stored_hash or not isinstance(stored_hash, str):
        return False
    parts = stored_hash.split("$")
    if len(parts) != 6 or parts[0] != "scrypt":
        return False
    try:
        n, r, p = int(parts[1]), int(parts[2]), int(parts[3])
        salt = bytes.fromhex(parts[4])
        expected = bytes.fromhex(parts[5])
    except (ValueError, TypeError):
        return False
    derived = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=n,
        r=r,
        p=p,
        dklen=len(expected),
    )
    return hmac.compare_digest(derived, expected)


# ---------------- Validation helpers ----------------


def _validate_card(card_id: str, card: Any) -> dict[str, Any]:
    if not isinstance(card_id, str) or not card_id:
        raise ValueError("card id must be a non-empty string")
    if not isinstance(card, dict):
        raise ValueError("card must be an object")
    if card.get("id") != card_id:
        raise ValueError("card.id must match card key")
    if not isinstance(card.get("title"), str):
        raise ValueError("card.title must be a string")
    if not isinstance(card.get("details"), str):
        raise ValueError("card.details must be a string")

    sanitized: dict[str, Any] = {
        "id": card_id,
        "title": _sanitize_string(card["title"], MAX_CARD_TITLE_LEN),
        "details": _sanitize_string(card["details"], MAX_CARD_DETAILS_LEN),
    }

    priority = card.get("priority")
    if priority is not None:
        if not isinstance(priority, str) or priority not in ALLOWED_PRIORITIES:
            raise ValueError("card.priority must be one of low|medium|high|urgent")
        sanitized["priority"] = priority

    due_date = card.get("dueDate")
    if due_date is not None:
        if not isinstance(due_date, str):
            raise ValueError("card.dueDate must be a string (YYYY-MM-DD)")
        if due_date:
            try:
                datetime.strptime(due_date, "%Y-%m-%d")
            except ValueError as exc:
                raise ValueError("card.dueDate must be ISO date YYYY-MM-DD") from exc
        sanitized["dueDate"] = due_date

    labels = card.get("labels")
    if labels is not None:
        if not isinstance(labels, list):
            raise ValueError("card.labels must be a list of strings")
        if len(labels) > MAX_LABELS_PER_CARD:
            raise ValueError(f"card.labels may have at most {MAX_LABELS_PER_CARD} items")
        clean_labels: list[str] = []
        for label in labels:
            if not isinstance(label, str):
                raise ValueError("card.labels entries must be strings")
            clean_labels.append(_sanitize_string(label, MAX_LABEL_LEN))
        sanitized["labels"] = clean_labels

    assignee = card.get("assignee")
    if assignee is not None:
        if not isinstance(assignee, str):
            raise ValueError("card.assignee must be a string")
        sanitized["assignee"] = _sanitize_string(assignee, MAX_USERNAME_LEN)

    created_at = card.get("createdAt")
    if isinstance(created_at, str):
        sanitized["createdAt"] = created_at[:40]

    archived = card.get("archived")
    if archived is not None:
        if not isinstance(archived, bool):
            raise ValueError("card.archived must be a boolean")
        if archived:
            sanitized["archived"] = True

    attachments = card.get("attachments")
    if attachments is not None:
        if not isinstance(attachments, list):
            raise ValueError("card.attachments must be a list")
        if len(attachments) > MAX_ATTACHMENTS_PER_CARD:
            raise ValueError(
                f"card.attachments may have at most {MAX_ATTACHMENTS_PER_CARD} entries"
            )
        clean_attachments: list[dict[str, Any]] = []
        seen_attachment_ids: set[str] = set()
        for entry in attachments:
            if not isinstance(entry, dict):
                raise ValueError("card.attachments entries must be objects")
            entry_id = entry.get("id")
            label = entry.get("label")
            url = entry.get("url")
            if not isinstance(entry_id, str) or not entry_id:
                raise ValueError("attachment.id must be a non-empty string")
            if entry_id in seen_attachment_ids:
                raise ValueError(f"duplicate attachment id: {entry_id}")
            seen_attachment_ids.add(entry_id)
            if not isinstance(label, str) or not label.strip():
                raise ValueError("attachment.label is required")
            if not isinstance(url, str) or not url.strip():
                raise ValueError("attachment.url is required")
            stripped_url = url.strip()
            if len(stripped_url) > MAX_ATTACHMENT_URL_LEN:
                raise ValueError("attachment.url is too long")
            lowered = stripped_url.lower()
            if not (lowered.startswith("http://") or lowered.startswith("https://")):
                raise ValueError("attachment.url must start with http:// or https://")
            clean_attachments.append(
                {
                    "id": entry_id,
                    "label": _sanitize_string(
                        label.strip(), MAX_ATTACHMENT_LABEL_LEN
                    ),
                    "url": stripped_url,
                }
            )
        if clean_attachments:
            sanitized["attachments"] = clean_attachments

    time_entries = card.get("timeEntries")
    if time_entries is not None:
        if not isinstance(time_entries, list):
            raise ValueError("card.timeEntries must be a list")
        if len(time_entries) > MAX_TIME_ENTRIES_PER_CARD:
            raise ValueError(
                f"card.timeEntries may have at most {MAX_TIME_ENTRIES_PER_CARD} entries"
            )
        clean_entries: list[dict[str, Any]] = []
        seen_entry_ids: set[str] = set()
        open_entries = 0
        for entry in time_entries:
            if not isinstance(entry, dict):
                raise ValueError("card.timeEntries entries must be objects")
            entry_id = entry.get("id")
            started_at = entry.get("startedAt")
            ended_at = entry.get("endedAt")
            seconds = entry.get("seconds")
            if not isinstance(entry_id, str) or not entry_id:
                raise ValueError("timeEntry.id must be a non-empty string")
            if entry_id in seen_entry_ids:
                raise ValueError(f"duplicate timeEntry id: {entry_id}")
            seen_entry_ids.add(entry_id)
            if not isinstance(started_at, str) or not started_at:
                raise ValueError("timeEntry.startedAt is required")
            sanitized_entry: dict[str, Any] = {
                "id": entry_id,
                "startedAt": started_at[:40],
            }
            if ended_at is None:
                open_entries += 1
                if open_entries > MAX_OPEN_TIME_ENTRIES_PER_CARD:
                    raise ValueError(
                        "card may have at most one open timeEntry"
                    )
            else:
                if not isinstance(ended_at, str) or not ended_at:
                    raise ValueError("timeEntry.endedAt must be a string")
                sanitized_entry["endedAt"] = ended_at[:40]
            if seconds is not None:
                if isinstance(seconds, bool) or not isinstance(seconds, int):
                    raise ValueError("timeEntry.seconds must be an integer")
                if seconds < 0:
                    raise ValueError("timeEntry.seconds must be >= 0")
                if seconds > MAX_TIME_ENTRY_SECONDS:
                    raise ValueError("timeEntry.seconds is too large")
                sanitized_entry["seconds"] = seconds
            clean_entries.append(sanitized_entry)
        if clean_entries:
            sanitized["timeEntries"] = clean_entries

    linked_ids = card.get("linkedCardIds")
    if linked_ids is not None:
        if not isinstance(linked_ids, list):
            raise ValueError("card.linkedCardIds must be a list of strings")
        clean_links: list[str] = []
        seen_links: set[str] = set()
        for entry in linked_ids:
            if not isinstance(entry, str) or not entry:
                raise ValueError("card.linkedCardIds entries must be non-empty strings")
            if entry == card_id:
                raise ValueError("card cannot link to itself")
            if entry in seen_links:
                continue
            seen_links.add(entry)
            clean_links.append(entry)
        if clean_links:
            sanitized["linkedCardIds"] = clean_links

    comments = card.get("comments")
    if comments is not None:
        if not isinstance(comments, list):
            raise ValueError("card.comments must be a list")
        if len(comments) > MAX_COMMENTS_PER_CARD:
            raise ValueError(
                f"card.comments may have at most {MAX_COMMENTS_PER_CARD} items"
            )
        clean_comments: list[dict[str, Any]] = []
        seen_comment_ids: set[str] = set()
        for comment in comments:
            if not isinstance(comment, dict):
                raise ValueError("card.comments entries must be objects")
            comment_id = comment.get("id")
            comment_author = comment.get("author")
            comment_body = comment.get("body")
            comment_created = comment.get("createdAt")
            if not isinstance(comment_id, str) or not comment_id:
                raise ValueError("comment.id must be a non-empty string")
            if comment_id in seen_comment_ids:
                raise ValueError(f"duplicate comment id: {comment_id}")
            seen_comment_ids.add(comment_id)
            if not isinstance(comment_author, str) or not comment_author:
                raise ValueError("comment.author must be a non-empty string")
            if not isinstance(comment_body, str) or not comment_body.strip():
                raise ValueError("comment.body is required")
            entry: dict[str, Any] = {
                "id": comment_id,
                "author": _sanitize_string(comment_author, MAX_USERNAME_LEN),
                "body": _sanitize_string(comment_body, MAX_COMMENT_BODY_LEN),
            }
            if isinstance(comment_created, str):
                entry["createdAt"] = comment_created[:40]
            clean_comments.append(entry)
        sanitized["comments"] = clean_comments

    subtasks = card.get("subtasks")
    if subtasks is not None:
        if not isinstance(subtasks, list):
            raise ValueError("card.subtasks must be a list")
        if len(subtasks) > MAX_SUBTASKS_PER_CARD:
            raise ValueError(
                f"card.subtasks may have at most {MAX_SUBTASKS_PER_CARD} items"
            )
        clean_subtasks: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for subtask in subtasks:
            if not isinstance(subtask, dict):
                raise ValueError("card.subtasks entries must be objects")
            sub_id = subtask.get("id")
            sub_title = subtask.get("title")
            sub_done = subtask.get("done")
            if not isinstance(sub_id, str) or not sub_id:
                raise ValueError("subtask.id must be a non-empty string")
            if sub_id in seen_ids:
                raise ValueError(f"duplicate subtask id: {sub_id}")
            seen_ids.add(sub_id)
            if not isinstance(sub_title, str):
                raise ValueError("subtask.title must be a string")
            if not isinstance(sub_done, bool):
                raise ValueError("subtask.done must be a boolean")
            clean_subtasks.append(
                {
                    "id": sub_id,
                    "title": _sanitize_string(sub_title, MAX_SUBTASK_TITLE_LEN),
                    "done": sub_done,
                }
            )
        sanitized["subtasks"] = clean_subtasks

    return sanitized


MAX_VIEWS_PER_BOARD = 20
MAX_VIEW_NAME_LEN = 60


def _validate_view(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("view must be an object")
    view_id = value.get("id")
    name = value.get("name")
    filt = value.get("filter")
    if not isinstance(view_id, str) or not view_id:
        raise ValueError("view.id must be a non-empty string")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("view.name is required")
    if not isinstance(filt, dict):
        raise ValueError("view.filter must be an object")

    sanitized_filter: dict[str, Any] = {}
    query_value = filt.get("query")
    if query_value is not None:
        if not isinstance(query_value, str):
            raise ValueError("view.filter.query must be a string")
        sanitized_filter["query"] = _sanitize_string(query_value, 200)
    priorities = filt.get("priorities")
    if priorities is not None:
        if not isinstance(priorities, list):
            raise ValueError("view.filter.priorities must be a list")
        for entry in priorities:
            if entry not in ALLOWED_PRIORITIES:
                raise ValueError("invalid priority in view.filter.priorities")
        sanitized_filter["priorities"] = list(priorities)
    labels = filt.get("labels")
    if labels is not None:
        if not isinstance(labels, list) or not all(isinstance(x, str) for x in labels):
            raise ValueError("view.filter.labels must be a list of strings")
        sanitized_filter["labels"] = [
            _sanitize_string(label, MAX_LABEL_LEN) for label in labels
        ]
    assignees = filt.get("assignees")
    if assignees is not None:
        if not isinstance(assignees, list) or not all(
            isinstance(x, str) for x in assignees
        ):
            raise ValueError("view.filter.assignees must be a list of strings")
        sanitized_filter["assignees"] = [
            _sanitize_string(name, MAX_USERNAME_LEN) for name in assignees
        ]
    overdue_only = filt.get("overdueOnly")
    if overdue_only is not None:
        if not isinstance(overdue_only, bool):
            raise ValueError("view.filter.overdueOnly must be a boolean")
        sanitized_filter["overdueOnly"] = overdue_only

    return {
        "id": view_id,
        "name": _sanitize_string(name.strip(), MAX_VIEW_NAME_LEN),
        "filter": sanitized_filter,
    }


def _validate_board_data(board: Any) -> dict[str, Any]:
    if not isinstance(board, dict):
        raise ValueError("board must be an object")

    columns = board.get("columns")
    cards = board.get("cards")
    if not isinstance(columns, list):
        raise ValueError("board.columns must be a list")
    if not isinstance(cards, dict):
        raise ValueError("board.cards must be an object")

    views_raw = board.get("views")
    sanitized_views: list[dict[str, Any]] | None = None
    if views_raw is not None:
        if not isinstance(views_raw, list):
            raise ValueError("board.views must be a list")
        if len(views_raw) > MAX_VIEWS_PER_BOARD:
            raise ValueError(
                f"board.views may have at most {MAX_VIEWS_PER_BOARD} entries"
            )
        seen_ids: set[str] = set()
        sanitized_views = []
        for view in views_raw:
            sanitized = _validate_view(view)
            if sanitized["id"] in seen_ids:
                raise ValueError(f"duplicate view id: {sanitized['id']}")
            seen_ids.add(sanitized["id"])
            sanitized_views.append(sanitized)

    sanitized_cards: dict[str, Any] = {
        card_id: _validate_card(card_id, card) for card_id, card in cards.items()
    }

    # Cross-reference link integrity: drop links that point to missing cards.
    for card_id, sanitized_card in sanitized_cards.items():
        linked = sanitized_card.get("linkedCardIds")
        if not linked:
            continue
        repaired = [link for link in linked if link in sanitized_cards]
        if repaired:
            sanitized_card["linkedCardIds"] = repaired
        else:
            sanitized_card.pop("linkedCardIds", None)

    sanitized_columns = []
    seen_column_ids: set[str] = set()
    for column in columns:
        if not isinstance(column, dict):
            raise ValueError("column must be an object")
        column_id = column.get("id")
        if not isinstance(column_id, str) or not column_id:
            raise ValueError("column.id must be a non-empty string")
        if column_id in seen_column_ids:
            raise ValueError(f"duplicate column id: {column_id}")
        seen_column_ids.add(column_id)
        if not isinstance(column.get("title"), str):
            raise ValueError("column.title must be a string")
        card_ids = column.get("cardIds")
        if not isinstance(card_ids, list) or not all(
            isinstance(card_id, str) for card_id in card_ids
        ):
            raise ValueError("column.cardIds must be a list of strings")
        for card_id in card_ids:
            if card_id not in sanitized_cards:
                raise ValueError(f"column references missing card id: {card_id}")
        sanitized_column: dict[str, Any] = {
            "id": column_id,
            "title": _sanitize_string(column["title"], MAX_COLUMN_TITLE_LEN),
            "cardIds": list(card_ids),
        }
        wip_limit = column.get("wipLimit")
        if wip_limit is not None:
            if isinstance(wip_limit, bool) or not isinstance(wip_limit, int):
                raise ValueError("column.wipLimit must be an integer")
            if wip_limit < 1 or wip_limit > MAX_WIP_LIMIT:
                raise ValueError(
                    f"column.wipLimit must be between 1 and {MAX_WIP_LIMIT}"
                )
            sanitized_column["wipLimit"] = wip_limit
        sanitized_columns.append(sanitized_column)

    result: dict[str, Any] = {
        "columns": sanitized_columns,
        "cards": sanitized_cards,
    }
    if sanitized_views is not None:
        result["views"] = sanitized_views
    return result


def _validate_board_name(name: Any) -> str:
    if not isinstance(name, str):
        raise ValueError("board name must be a string")
    cleaned = name.strip()
    if not cleaned:
        raise ValueError("board name is required")
    return _sanitize_string(cleaned, MAX_BOARD_NAME_LEN)


def _validate_username(username: Any) -> str:
    if not isinstance(username, str):
        raise ValueError("username must be a string")
    cleaned = username.strip()
    if not cleaned:
        raise ValueError("username is required")
    if len(cleaned) > MAX_USERNAME_LEN:
        raise ValueError(f"username may be at most {MAX_USERNAME_LEN} characters")
    if not all(ch.isalnum() or ch in {"_", "-", ".", "@"} for ch in cleaned):
        raise ValueError(
            "username may contain letters, digits, '_', '-', '.', '@'"
        )
    return cleaned


# ---------------- User CRUD ----------------


def create_user(
    username: str,
    password: str,
    display_name: str | None = None,
    role: str = "member",
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict[str, Any]:
    initialize_db(db_path)
    cleaned_username = _validate_username(username)
    cleaned_role = role if role in {"admin", "member"} else "member"
    cleaned_display = (
        _sanitize_string(display_name.strip(), MAX_DISPLAY_NAME_LEN)
        if isinstance(display_name, str) and display_name.strip()
        else cleaned_username
    )
    password_hash = hash_password(password)

    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        existing = connection.execute(
            "SELECT id FROM users WHERE username = ?", (cleaned_username,)
        ).fetchone()
        if existing is not None:
            raise ValueError("username already exists")
        cursor = connection.execute(
            """
            INSERT INTO users(username, password_hash, display_name, role, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (cleaned_username, password_hash, cleaned_display, cleaned_role, _now_iso()),
        )
        user_id = int(cursor.lastrowid)
        connection.commit()
    return {
        "id": user_id,
        "username": cleaned_username,
        "display_name": cleaned_display,
        "role": cleaned_role,
    }


def get_user(username: str, db_path: Path | str = DEFAULT_DB_PATH) -> dict[str, Any] | None:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        row = connection.execute(
            "SELECT id, username, password_hash, display_name, role FROM users WHERE username = ?",
            (cleaned,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": int(row["id"]),
            "username": row["username"],
            "password_hash": row["password_hash"],
            "display_name": row["display_name"] or row["username"],
            "role": row["role"] or "member",
        }


def list_users(db_path: Path | str = DEFAULT_DB_PATH) -> list[dict[str, Any]]:
    initialize_db(db_path)
    with get_connection(db_path) as connection:
        rows = connection.execute(
            "SELECT id, username, display_name, role, created_at FROM users ORDER BY username"
        ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "username": row["username"],
            "display_name": row["display_name"] or row["username"],
            "role": row["role"] or "member",
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def update_user_password(
    username: str, new_password: str, db_path: Path | str = DEFAULT_DB_PATH
) -> None:
    cleaned = _validate_username(username)
    new_hash = hash_password(new_password)
    initialize_db(db_path)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        result = connection.execute(
            "UPDATE users SET password_hash = ? WHERE username = ?",
            (new_hash, cleaned),
        )
        if result.rowcount == 0:
            raise ValueError("user not found")
        connection.commit()


def update_user_display_name(
    username: str,
    display_name: str,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> None:
    cleaned = _validate_username(username)
    if not isinstance(display_name, str) or not display_name.strip():
        raise ValueError("display_name is required")
    safe_name = _sanitize_string(display_name.strip(), MAX_DISPLAY_NAME_LEN)
    initialize_db(db_path)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        result = connection.execute(
            "UPDATE users SET display_name = ? WHERE username = ?",
            (safe_name, cleaned),
        )
        if result.rowcount == 0:
            raise ValueError("user not found")
        connection.commit()


def _get_user_id(connection: sqlite3.Connection, username: str) -> int:
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if row is None:
        raise ValueError("user not found")
    return int(row["id"])


# ---------------- Board CRUD ----------------


def _get_board_role(
    connection: sqlite3.Connection, username: str, board_id: int
) -> str | None:
    """Return 'owner' / 'editor' / 'viewer', or None if no access."""
    row = connection.execute(
        """
        SELECT
          CASE
            WHEN b.user_id = u.id THEN 'owner'
            ELSE bc.role
          END AS role
        FROM users u
        JOIN boards b ON b.id = ?
        LEFT JOIN board_collaborators bc
          ON bc.board_id = b.id AND bc.user_id = u.id
        WHERE u.username = ?
          AND (b.user_id = u.id OR bc.user_id = u.id)
        """,
        (int(board_id), username),
    ).fetchone()
    if row is None:
        return None
    return row["role"]


def list_boards_for_user(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> list[dict[str, Any]]:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT id, name, position, created_at, updated_at, role, owner_username FROM (
              SELECT b.id AS id, b.name AS name, b.position AS position,
                     b.created_at AS created_at, b.updated_at AS updated_at,
                     'owner' AS role, owner.username AS owner_username
              FROM boards b
              JOIN users owner ON owner.id = b.user_id
              WHERE owner.username = ?
              UNION ALL
              SELECT b.id AS id, b.name AS name, b.position AS position,
                     b.created_at AS created_at, b.updated_at AS updated_at,
                     bc.role AS role, owner.username AS owner_username
              FROM boards b
              JOIN board_collaborators bc ON bc.board_id = b.id
              JOIN users u ON u.id = bc.user_id
              JOIN users owner ON owner.id = b.user_id
              WHERE u.username = ?
            )
            ORDER BY position, id
            """,
            (cleaned, cleaned),
        ).fetchall()
        pinned_rows = connection.execute(
            """
            SELECT pb.board_id
            FROM pinned_boards pb
            JOIN users u ON u.id = pb.user_id
            WHERE u.username = ?
            """,
            (cleaned,),
        ).fetchall()
        pinned = {int(row["board_id"]) for row in pinned_rows}
    return [
        {
            "id": int(row["id"]),
            "name": row["name"],
            "position": int(row["position"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "role": row["role"],
            "owner": row["owner_username"],
            "pinned": int(row["id"]) in pinned,
        }
        for row in rows
    ]


def pin_board_for_user(
    username: str, board_id: int, db_path: Path | str = DEFAULT_DB_PATH
) -> bool:
    """Star a board the user can access. Returns True if newly pinned, False if already pinned."""
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        role = _get_board_role(connection, cleaned, int(board_id))
        if role is None:
            raise ValueError("board not found")
        user_id = _get_user_id(connection, cleaned)
        result = connection.execute(
            """
            INSERT INTO pinned_boards(user_id, board_id)
            VALUES (?, ?)
            ON CONFLICT(user_id, board_id) DO NOTHING
            """,
            (user_id, int(board_id)),
        )
        connection.commit()
    return result.rowcount > 0


def unpin_board_for_user(
    username: str, board_id: int, db_path: Path | str = DEFAULT_DB_PATH
) -> bool:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        result = connection.execute(
            """
            DELETE FROM pinned_boards
            WHERE board_id = ?
              AND user_id = (SELECT id FROM users WHERE username = ?)
            """,
            (int(board_id), cleaned),
        )
        connection.commit()
    return result.rowcount > 0


def create_board_for_user(
    username: str,
    name: str,
    board: dict[str, Any] | None = None,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict[str, Any]:
    initialize_db(db_path)
    cleaned_username = _validate_username(username)
    cleaned_name = _validate_board_name(name)

    if board is None:
        board = {"columns": [], "cards": {}}
    validated = _validate_board_data(board)

    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        user_id = _get_user_id(connection, cleaned_username)
        position_row = connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM boards WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        next_position = int(position_row["next_pos"])
        cursor = connection.execute(
            """
            INSERT INTO boards(user_id, name, board_json, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                cleaned_name,
                json.dumps(validated, separators=(",", ":")),
                next_position,
                _now_iso(),
                _now_iso(),
            ),
        )
        board_id = int(cursor.lastrowid)
        _record_activity(
            connection,
            user_id=user_id,
            board_id=board_id,
            action="board.created",
            details={"name": cleaned_name},
        )
        connection.commit()
    return {
        "id": board_id,
        "name": cleaned_name,
        "position": next_position,
        "board": validated,
    }


def duplicate_board_for_user(
    username: str,
    source_board_id: int,
    name: str | None = None,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict[str, Any]:
    """Clone a board the user can read. The clone is owned by `username`."""
    record = get_board_for_user_by_id(username, source_board_id, db_path)
    if record is None:
        raise ValueError("board not found")
    new_name = name.strip() if isinstance(name, str) and name.strip() else f"{record['name']} (copy)"
    cleaned_name = _validate_board_name(new_name)
    return create_board_for_user(
        username=username,
        name=cleaned_name,
        board=record["board"],
        db_path=db_path,
    )


def get_board_for_user_by_id(
    username: str, board_id: int, db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any] | None:
    """Fetch a board if the user is owner OR a collaborator (any role)."""
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        role = _get_board_role(connection, cleaned, int(board_id))
        if role is None:
            return None
        row = connection.execute(
            """
            SELECT b.id, b.name, b.position, b.board_json, b.created_at, b.updated_at,
                   owner.username AS owner_username
            FROM boards b
            JOIN users owner ON owner.id = b.user_id
            WHERE b.id = ?
            """,
            (int(board_id),),
        ).fetchone()
        if row is None:
            return None
        try:
            parsed = json.loads(row["board_json"])
        except json.JSONDecodeError as exc:
            raise ValueError("stored board_json is invalid JSON") from exc
        validated = _validate_board_data(parsed)
        return {
            "id": int(row["id"]),
            "name": row["name"],
            "position": int(row["position"]),
            "board": validated,
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "role": role,
            "owner": row["owner_username"],
        }


def update_board_for_user(
    username: str,
    board_id: int,
    board: dict[str, Any] | None = None,
    name: str | None = None,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict[str, Any]:
    initialize_db(db_path)
    cleaned_username = _validate_username(username)
    validated_board = _validate_board_data(board) if board is not None else None
    cleaned_name = _validate_board_name(name) if name is not None else None

    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        user_id = _get_user_id(connection, cleaned_username)
        role = _get_board_role(connection, cleaned_username, int(board_id))
        if role is None:
            raise ValueError("board not found")
        if role not in {"owner", "editor"}:
            raise PermissionError("editor role required to update board")

        # Renaming requires owner role.
        if cleaned_name is not None and role != "owner":
            raise PermissionError("only the owner can rename a board")

        existing = connection.execute(
            "SELECT id, name, board_json FROM boards WHERE id = ?",
            (int(board_id),),
        ).fetchone()
        if existing is None:
            raise ValueError("board not found")
        old_board_payload = _safe_json_loads(existing["board_json"]) or {"columns": [], "cards": {}}

        sets: list[str] = []
        params: list[Any] = []
        if validated_board is not None:
            sets.append("board_json = ?")
            params.append(json.dumps(validated_board, separators=(",", ":")))
        if cleaned_name is not None:
            sets.append("name = ?")
            params.append(cleaned_name)
        sets.append("updated_at = ?")
        params.append(_now_iso())
        params.append(int(board_id))

        connection.execute(
            f"UPDATE boards SET {', '.join(sets)} WHERE id = ?",
            params,
        )

        if cleaned_name is not None and cleaned_name != existing["name"]:
            _record_activity(
                connection,
                user_id=user_id,
                board_id=int(board_id),
                action="board.renamed",
                details={"from": existing["name"], "to": cleaned_name},
            )
        if validated_board is not None:
            _record_activity(
                connection,
                user_id=user_id,
                board_id=int(board_id),
                action="board.updated",
                details={
                    "columns": len(validated_board["columns"]),
                    "cards": len(validated_board["cards"]),
                },
            )
            _notify_new_mentions(
                connection,
                actor_user_id=user_id,
                actor_username=cleaned_username,
                board_id=int(board_id),
                board_name=cleaned_name or existing["name"],
                old_board=old_board_payload,
                new_board=validated_board,
            )

        connection.commit()

    fetched = get_board_for_user_by_id(cleaned_username, board_id, db_path)
    if fetched is None:
        raise ValueError("board not found after update")
    return fetched


def delete_board_for_user(
    username: str, board_id: int, db_path: Path | str = DEFAULT_DB_PATH
) -> bool:
    """Owner-only delete. Collaborators get PermissionError; non-members get False."""
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        role = _get_board_role(connection, cleaned, int(board_id))
        if role is None:
            return False
        if role != "owner":
            raise PermissionError("only the owner can delete a board")
        user_id = _get_user_id(connection, cleaned)
        result = connection.execute(
            "DELETE FROM boards WHERE id = ? AND user_id = ?",
            (int(board_id), user_id),
        )
        connection.commit()
    return result.rowcount > 0


# ---------------- Activity log ----------------


def _record_activity(
    connection: sqlite3.Connection,
    *,
    user_id: int,
    board_id: int,
    action: str,
    details: dict[str, Any] | None = None,
) -> None:
    payload = json.dumps(details, separators=(",", ":")) if details else None
    connection.execute(
        """
        INSERT INTO activity_log(user_id, board_id, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, board_id, action, payload, _now_iso()),
    )


def record_activity(
    username: str,
    board_id: int,
    action: str,
    details: dict[str, Any] | None = None,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> None:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        user_id = _get_user_id(connection, cleaned)
        _record_activity(
            connection,
            user_id=user_id,
            board_id=int(board_id),
            action=action,
            details=details,
        )
        connection.commit()


def list_activity_for_board(
    username: str,
    board_id: int,
    limit: int = 50,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict[str, Any]]:
    """Return activity for `board_id`. Callers must already have verified
    that `username` has access to the board — this query does not re-check.

    Returns activity from all actors (owner + collaborators)."""
    initialize_db(db_path)
    _validate_username(username)
    safe_limit = max(1, min(int(limit), 500))
    with get_connection(db_path) as connection:
        rows = connection.execute(
            """
            SELECT a.id, a.action, a.details, a.created_at, u.username
            FROM activity_log a
            JOIN users u ON u.id = a.user_id
            WHERE a.board_id = ?
            ORDER BY a.id DESC
            LIMIT ?
            """,
            (int(board_id), safe_limit),
        ).fetchall()
    return [
        {
            "id": int(row["id"]),
            "action": row["action"],
            "details": _safe_json_loads(row["details"]),
            "created_at": row["created_at"],
            "username": row["username"],
        }
        for row in rows
    ]


# ---------------- Collaborators ----------------


def add_board_collaborator(
    owner_username: str,
    board_id: int,
    collaborator_username: str,
    role: str,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict[str, Any]:
    if role not in {"viewer", "editor"}:
        raise ValueError("role must be 'viewer' or 'editor'")
    initialize_db(db_path)
    cleaned_owner = _validate_username(owner_username)
    cleaned_collab = _validate_username(collaborator_username)
    if cleaned_owner == cleaned_collab:
        raise ValueError("cannot add the owner as a collaborator")

    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        owner_role = _get_board_role(connection, cleaned_owner, int(board_id))
        if owner_role is None:
            raise ValueError("board not found")
        if owner_role != "owner":
            raise PermissionError("only the owner can add collaborators")
        owner_id = _get_user_id(connection, cleaned_owner)

        collaborator_row = connection.execute(
            "SELECT id, display_name FROM users WHERE username = ?",
            (cleaned_collab,),
        ).fetchone()
        if collaborator_row is None:
            raise ValueError("collaborator user does not exist")
        collaborator_id = int(collaborator_row["id"])

        connection.execute(
            """
            INSERT INTO board_collaborators(board_id, user_id, role)
            VALUES (?, ?, ?)
            ON CONFLICT(board_id, user_id) DO UPDATE SET role = excluded.role
            """,
            (int(board_id), collaborator_id, role),
        )
        _record_activity(
            connection,
            user_id=owner_id,
            board_id=int(board_id),
            action="board.collaborator_added",
            details={"username": cleaned_collab, "role": role},
        )
        # Fetch board name for the notification payload.
        board_name_row = connection.execute(
            "SELECT name FROM boards WHERE id = ?", (int(board_id),)
        ).fetchone()
        _create_notification(
            connection,
            target_user_id=collaborator_id,
            kind="collaborator_added",
            board_id=int(board_id),
            payload={
                "actor": cleaned_owner,
                "role": role,
                "board_name": board_name_row["name"] if board_name_row else None,
            },
        )
        connection.commit()
    return {
        "username": cleaned_collab,
        "display_name": collaborator_row["display_name"] or cleaned_collab,
        "role": role,
    }


def remove_board_collaborator(
    owner_username: str,
    board_id: int,
    collaborator_username: str,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> bool:
    initialize_db(db_path)
    cleaned_owner = _validate_username(owner_username)
    cleaned_collab = _validate_username(collaborator_username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        owner_role = _get_board_role(connection, cleaned_owner, int(board_id))
        if owner_role is None:
            return False
        if owner_role != "owner":
            raise PermissionError("only the owner can remove collaborators")
        owner_id = _get_user_id(connection, cleaned_owner)

        result = connection.execute(
            """
            DELETE FROM board_collaborators
            WHERE board_id = ?
              AND user_id = (SELECT id FROM users WHERE username = ?)
            """,
            (int(board_id), cleaned_collab),
        )
        if result.rowcount > 0:
            _record_activity(
                connection,
                user_id=owner_id,
                board_id=int(board_id),
                action="board.collaborator_removed",
                details={"username": cleaned_collab},
            )
        connection.commit()
    return result.rowcount > 0


def list_board_collaborators(
    username: str,
    board_id: int,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict[str, Any]]:
    """List collaborators on a board. Caller must have read access."""
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        role = _get_board_role(connection, cleaned, int(board_id))
        if role is None:
            raise ValueError("board not found")
        rows = connection.execute(
            """
            SELECT u.username, u.display_name, bc.role, bc.created_at
            FROM board_collaborators bc
            JOIN users u ON u.id = bc.user_id
            WHERE bc.board_id = ?
            ORDER BY u.username
            """,
            (int(board_id),),
        ).fetchall()
    return [
        {
            "username": row["username"],
            "display_name": row["display_name"] or row["username"],
            "role": row["role"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


# ---------------- Notifications ----------------


_MENTION_RE = re.compile(r"@([A-Za-z0-9_](?:[A-Za-z0-9_.\-@]*[A-Za-z0-9_])?)")


def _extract_mentions(body: str) -> set[str]:
    if not isinstance(body, str):
        return set()
    return {match.group(1) for match in _MENTION_RE.finditer(body)}


def _comments_by_id(card: dict[str, Any]) -> dict[str, dict[str, Any]]:
    comments = card.get("comments")
    if not isinstance(comments, list):
        return {}
    return {
        comment["id"]: comment
        for comment in comments
        if isinstance(comment, dict) and isinstance(comment.get("id"), str)
    }


def _column_title_for_card(
    new_board: dict[str, Any], card_id: str
) -> str | None:
    columns = new_board.get("columns")
    if not isinstance(columns, list):
        return None
    for column in columns:
        if not isinstance(column, dict):
            continue
        card_ids = column.get("cardIds")
        if isinstance(card_ids, list) and card_id in card_ids:
            title = column.get("title")
            return title if isinstance(title, str) else None
    return None


def _resolve_username_to_user_id(
    connection: sqlite3.Connection, username: str
) -> int | None:
    """Look up a user_id by exact username, falling back to a case-insensitive
    match. Returns None if no user is found."""
    if not isinstance(username, str) or not username:
        return None
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()
    if row is not None:
        return int(row["id"])
    row = connection.execute(
        "SELECT id FROM users WHERE LOWER(username) = LOWER(?)", (username,)
    ).fetchone()
    return int(row["id"]) if row is not None else None


def _notify_new_mentions(
    connection: sqlite3.Connection,
    *,
    actor_user_id: int,
    actor_username: str,
    board_id: int,
    board_name: str,
    old_board: dict[str, Any],
    new_board: dict[str, Any],
) -> None:
    """Notify users about (a) new @mentions in card comments and
    (b) cards newly assigned to them. Self-actions are skipped."""
    old_cards = old_board.get("cards") or {}
    new_cards = new_board.get("cards") or {}
    if not isinstance(new_cards, dict):
        return

    # --- New comments → mention notifications ---
    new_comments: list[tuple[str, dict[str, Any]]] = []
    for card_id, new_card in new_cards.items():
        if not isinstance(new_card, dict):
            continue
        old_card = old_cards.get(card_id) if isinstance(old_cards, dict) else None
        old_comment_ids = set(_comments_by_id(old_card).keys()) if isinstance(old_card, dict) else set()
        for comment in new_card.get("comments") or []:
            if not isinstance(comment, dict):
                continue
            if comment.get("id") in old_comment_ids:
                continue
            new_comments.append((card_id, comment))

    for card_id, comment in new_comments:
        body = comment.get("body") or ""
        mentions = _extract_mentions(body)
        if not mentions:
            continue
        card = new_cards.get(card_id) or {}
        title = card.get("title") if isinstance(card, dict) else card_id
        for username in mentions:
            if username == actor_username:
                continue
            target_id = _resolve_username_to_user_id(connection, username)
            if target_id is None or target_id == actor_user_id:
                continue
            _create_notification(
                connection,
                target_user_id=target_id,
                kind="mention",
                board_id=board_id,
                payload={
                    "actor": actor_username,
                    "board_name": board_name,
                    "card_id": card_id,
                    "card_title": title,
                    "snippet": body[:200],
                },
            )

    # --- Assignment changes → card_assigned notifications ---
    for card_id, new_card in new_cards.items():
        if not isinstance(new_card, dict):
            continue
        new_assignee = new_card.get("assignee")
        if not isinstance(new_assignee, str) or not new_assignee:
            continue
        old_card = old_cards.get(card_id) if isinstance(old_cards, dict) else None
        old_assignee = (
            old_card.get("assignee") if isinstance(old_card, dict) else None
        )
        if new_assignee == old_assignee:
            continue
        target_id = _resolve_username_to_user_id(connection, new_assignee)
        if target_id is None:
            continue
        _create_notification(
            connection,
            target_user_id=target_id,
            kind="card_assigned",
            board_id=board_id,
            payload={
                "actor": actor_username,
                "board_name": board_name,
                "card_id": card_id,
                "card_title": new_card.get("title", ""),
                "column_title": _column_title_for_card(new_board, card_id),
            },
        )


def _create_notification(
    connection: sqlite3.Connection,
    *,
    target_user_id: int,
    kind: str,
    board_id: int | None,
    payload: dict[str, Any] | None,
) -> None:
    connection.execute(
        """
        INSERT INTO notifications(user_id, kind, board_id, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            target_user_id,
            kind,
            board_id,
            json.dumps(payload, separators=(",", ":")) if payload else None,
            _now_iso(),
        ),
    )


def list_notifications(
    username: str,
    only_unread: bool = False,
    limit: int = 50,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict[str, Any]]:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    safe_limit = max(1, min(int(limit), 200))
    with get_connection(db_path) as connection:
        user_row = connection.execute(
            "SELECT id FROM users WHERE username = ?", (cleaned,)
        ).fetchone()
        if user_row is None:
            return []
        sql = (
            "SELECT id, kind, board_id, payload, read_at, created_at "
            "FROM notifications WHERE user_id = ?"
        )
        params: list[Any] = [int(user_row["id"])]
        if only_unread:
            sql += " AND read_at IS NULL"
        sql += " ORDER BY id DESC LIMIT ?"
        params.append(safe_limit)
        rows = connection.execute(sql, params).fetchall()
    return [
        {
            "id": int(row["id"]),
            "kind": row["kind"],
            "board_id": row["board_id"],
            "payload": _safe_json_loads(row["payload"]),
            "read_at": row["read_at"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def count_unread_notifications(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> int:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        row = connection.execute(
            """
            SELECT COUNT(*) AS unread FROM notifications n
            JOIN users u ON u.id = n.user_id
            WHERE u.username = ? AND n.read_at IS NULL
            """,
            (cleaned,),
        ).fetchone()
    return int(row["unread"]) if row else 0


def mark_notification_read(
    username: str,
    notification_id: int,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> bool:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        result = connection.execute(
            """
            UPDATE notifications
            SET read_at = ?
            WHERE id = ?
              AND user_id = (SELECT id FROM users WHERE username = ?)
              AND read_at IS NULL
            """,
            (_now_iso(), int(notification_id), cleaned),
        )
        connection.commit()
    return result.rowcount > 0


def mark_all_notifications_read(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> int:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        result = connection.execute(
            """
            UPDATE notifications
            SET read_at = ?
            WHERE read_at IS NULL
              AND user_id = (SELECT id FROM users WHERE username = ?)
            """,
            (_now_iso(), cleaned),
        )
        connection.commit()
    return int(result.rowcount)


# ---------------- Public share tokens ----------------


def enable_board_share_token(
    username: str, board_id: int, db_path: Path | str = DEFAULT_DB_PATH
) -> str:
    """Owner-only. Returns an existing token or creates a fresh one."""
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        role = _get_board_role(connection, cleaned, int(board_id))
        if role is None:
            raise ValueError("board not found")
        if role != "owner":
            raise PermissionError("only the owner can manage share links")
        existing = connection.execute(
            "SELECT token FROM board_share_tokens WHERE board_id = ?",
            (int(board_id),),
        ).fetchone()
        if existing:
            connection.commit()
            return existing["token"]
        token = secrets.token_urlsafe(24)
        connection.execute(
            "INSERT INTO board_share_tokens(board_id, token) VALUES (?, ?)",
            (int(board_id), token),
        )
        connection.commit()
        return token


def disable_board_share_token(
    username: str, board_id: int, db_path: Path | str = DEFAULT_DB_PATH
) -> bool:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        role = _get_board_role(connection, cleaned, int(board_id))
        if role is None:
            return False
        if role != "owner":
            raise PermissionError("only the owner can manage share links")
        result = connection.execute(
            "DELETE FROM board_share_tokens WHERE board_id = ?",
            (int(board_id),),
        )
        connection.commit()
    return result.rowcount > 0


def get_board_share_token(
    username: str, board_id: int, db_path: Path | str = DEFAULT_DB_PATH
) -> str | None:
    initialize_db(db_path)
    cleaned = _validate_username(username)
    with get_connection(db_path) as connection:
        role = _get_board_role(connection, cleaned, int(board_id))
        if role is None:
            return None
        row = connection.execute(
            "SELECT token FROM board_share_tokens WHERE board_id = ?",
            (int(board_id),),
        ).fetchone()
        return row["token"] if row else None


def get_public_board_by_token(
    token: str, db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any] | None:
    if not isinstance(token, str) or not token.strip():
        return None
    initialize_db(db_path)
    with get_connection(db_path) as connection:
        row = connection.execute(
            """
            SELECT b.id, b.name, b.position, b.board_json, b.updated_at,
                   owner.username AS owner_username
            FROM board_share_tokens s
            JOIN boards b ON b.id = s.board_id
            JOIN users owner ON owner.id = b.user_id
            WHERE s.token = ?
            """,
            (token.strip(),),
        ).fetchone()
        if row is None:
            return None
        try:
            parsed = json.loads(row["board_json"])
        except json.JSONDecodeError:
            return None
        validated = _validate_board_data(parsed)
        return {
            "id": int(row["id"]),
            "name": row["name"],
            "owner": row["owner_username"],
            "updated_at": row["updated_at"],
            "board": validated,
        }


# ---------------- Cross-board search ----------------


def search_user_content(
    username: str,
    query: str,
    limit: int = 30,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict[str, list[dict[str, Any]]]:
    """Case-insensitive substring search across boards the user can access.

    Returns matched boards (by name) and matched cards (by title, details,
    labels, assignee, comment body, subtask title) with board context.
    """
    cleaned_user = _validate_username(username)
    if not isinstance(query, str):
        return {"boards": [], "cards": []}
    q = query.strip()
    if not q:
        return {"boards": [], "cards": []}
    needle = q.lower()
    safe_limit = max(1, min(int(limit), 100))

    boards = list_boards_for_user(cleaned_user, db_path)
    matched_boards: list[dict[str, Any]] = []
    matched_cards: list[dict[str, Any]] = []
    for summary in boards:
        if needle in summary["name"].lower():
            matched_boards.append(
                {
                    "id": summary["id"],
                    "name": summary["name"],
                    "role": summary.get("role"),
                    "owner": summary.get("owner"),
                }
            )
        record = get_board_for_user_by_id(cleaned_user, summary["id"], db_path)
        if record is None:
            continue
        column_for_card = _column_title_by_card_id(record["board"])
        for card in record["board"]["cards"].values():
            if card.get("archived"):
                continue
            haystack_pieces = [
                card.get("title") or "",
                card.get("details") or "",
                card.get("assignee") or "",
                " ".join(card.get("labels") or []),
                " ".join(
                    (subtask.get("title") or "")
                    for subtask in (card.get("subtasks") or [])
                ),
                " ".join(
                    (comment.get("body") or "")
                    for comment in (card.get("comments") or [])
                ),
            ]
            haystack = " ".join(haystack_pieces).lower()
            if needle not in haystack:
                continue
            matched_cards.append(
                {
                    "board_id": int(record["id"]),
                    "board_name": record["name"],
                    "column_title": column_for_card.get(card["id"]),
                    "card_id": card["id"],
                    "title": card.get("title", ""),
                    "snippet": (card.get("details") or "")[:200],
                    "priority": card.get("priority"),
                    "assignee": card.get("assignee"),
                    "labels": card.get("labels") or [],
                }
            )
            if len(matched_cards) >= safe_limit:
                break
        if len(matched_cards) >= safe_limit:
            break

    return {
        "boards": matched_boards[:safe_limit],
        "cards": matched_cards[:safe_limit],
    }


# ---------------- Cross-board user tasks ----------------


def list_user_tasks(
    username: str,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> list[dict[str, Any]]:
    """Aggregate non-archived cards assigned to `username` across every
    board the user can access (owner or collaborator).

    Returns a flat list with board context, sorted by:
      overdue first, then due-soonest, then priority order, then board name.
    """
    cleaned = _validate_username(username)
    boards = list_boards_for_user(cleaned, db_path)
    if not boards:
        return []

    priority_rank = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    today = datetime.now(timezone.utc).date()
    rows: list[dict[str, Any]] = []
    for summary in boards:
        record = get_board_for_user_by_id(cleaned, summary["id"], db_path)
        if record is None:
            continue
        board_name = record["name"]
        board_id = int(record["id"])
        column_for_card = _column_title_by_card_id(record["board"])
        for card in record["board"]["cards"].values():
            if card.get("archived"):
                continue
            if card.get("assignee") != cleaned:
                continue
            due = card.get("dueDate")
            overdue = False
            due_in_days: int | None = None
            if isinstance(due, str) and due:
                try:
                    due_date = datetime.strptime(due, "%Y-%m-%d").date()
                    delta = (due_date - today).days
                    overdue = delta < 0
                    due_in_days = delta
                except ValueError:
                    pass
            rows.append(
                {
                    "board_id": board_id,
                    "board_name": board_name,
                    "column_title": column_for_card.get(card["id"]),
                    "card_id": card["id"],
                    "title": card["title"],
                    "details": card.get("details", ""),
                    "priority": card.get("priority"),
                    "due_date": due,
                    "labels": card.get("labels") or [],
                    "overdue": overdue,
                    "due_in_days": due_in_days,
                    "subtasks": card.get("subtasks") or [],
                }
            )

    def sort_key(row: dict[str, Any]) -> tuple:
        return (
            0 if row["overdue"] else 1,
            row["due_in_days"] if row["due_in_days"] is not None else 10**6,
            priority_rank.get(row.get("priority") or "", 9),
            row["board_name"].lower(),
        )

    rows.sort(key=sort_key)
    return rows


# ---------------- Stats ----------------


def board_stats(
    username: str,
    board_id: int,
    db_path: Path | str = DEFAULT_DB_PATH,
) -> dict[str, Any]:
    """Return per-board card statistics. Caller must have access."""
    record = get_board_for_user_by_id(username, int(board_id), db_path)
    if record is None:
        raise ValueError("board not found")
    board = record["board"]

    by_priority: dict[str, int] = {}
    by_column: dict[str, int] = {}
    overdue_count = 0
    with_due_date = 0
    subtask_done = 0
    subtask_total = 0

    cards_by_id = board["cards"]
    archived_ids = {
        card_id
        for card_id, card in cards_by_id.items()
        if card.get("archived") is True
    }

    column_lookup: dict[str, str] = {}
    for column in board["columns"]:
        column_lookup[column["id"]] = column["title"]
        active_count = sum(
            1 for card_id in column["cardIds"] if card_id not in archived_ids
        )
        by_column[column["title"]] = active_count

    today = datetime.now(timezone.utc).date()
    active_count = 0
    for card_id, card in cards_by_id.items():
        if card_id in archived_ids:
            continue
        active_count += 1
        priority = card.get("priority")
        if priority:
            by_priority[priority] = by_priority.get(priority, 0) + 1

        due = card.get("dueDate")
        if due:
            with_due_date += 1
            try:
                if datetime.strptime(due, "%Y-%m-%d").date() < today:
                    overdue_count += 1
            except ValueError:
                pass

        for subtask in card.get("subtasks") or []:
            subtask_total += 1
            if subtask.get("done"):
                subtask_done += 1

    return {
        "total_cards": active_count,
        "total_columns": len(board["columns"]),
        "by_priority": by_priority,
        "by_column": by_column,
        "overdue_count": overdue_count,
        "with_due_date": with_due_date,
        "subtasks": {"done": subtask_done, "total": subtask_total},
        "archived_count": len(archived_ids),
    }


# ---------------- Backwards-compatible single-board helpers ----------------
# These keep the original API working for the chat flow and tests, by always
# operating on the user's *first* board (or creating one).


def _get_or_create_default_board_id(
    connection: sqlite3.Connection, username: str
) -> int:
    user_id = _get_user_id(connection, username)
    row = connection.execute(
        "SELECT id FROM boards WHERE user_id = ? ORDER BY position, id LIMIT 1",
        (user_id,),
    ).fetchone()
    if row is not None:
        return int(row["id"])
    cursor = connection.execute(
        """
        INSERT INTO boards(user_id, name, board_json, position, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
        """,
        (
            user_id,
            "My Board",
            json.dumps({"columns": [], "cards": {}}, separators=(",", ":")),
            _now_iso(),
            _now_iso(),
        ),
    )
    return int(cursor.lastrowid)


def _ensure_user_legacy(connection: sqlite3.Connection, username: str) -> int:
    """For tests/legacy flows that pass a bare username — auto-create a row
    with no password if missing."""
    cleaned = _validate_username(username)
    row = connection.execute(
        "SELECT id FROM users WHERE username = ?", (cleaned,)
    ).fetchone()
    if row is not None:
        return int(row["id"])
    cursor = connection.execute(
        """
        INSERT INTO users(username, password_hash, display_name, role, created_at)
        VALUES (?, NULL, ?, 'member', ?)
        """,
        (cleaned, cleaned, _now_iso()),
    )
    return int(cursor.lastrowid)


def upsert_board_for_user(
    username: str, board: dict[str, Any], db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any]:
    """Legacy helper — saves to the user's first board (creating user/board
    if needed). Used by the chat flow and existing tests."""
    validated_board = _validate_board_data(board)
    initialize_db(db_path)

    with get_connection(db_path) as connection:
        connection.execute("BEGIN IMMEDIATE")
        _ensure_user_legacy(connection, username)
        board_id = _get_or_create_default_board_id(connection, _validate_username(username))
        connection.execute(
            """
            UPDATE boards
            SET board_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                json.dumps(validated_board, separators=(",", ":")),
                _now_iso(),
                board_id,
            ),
        )
        connection.commit()
    return validated_board


def get_board_for_user(
    username: str, db_path: Path | str = DEFAULT_DB_PATH
) -> dict[str, Any] | None:
    """Legacy helper — reads the user's first board, or None if user has none."""
    initialize_db(db_path)
    with get_connection(db_path) as connection:
        row = connection.execute(
            """
            SELECT b.board_json
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE u.username = ?
            ORDER BY b.position, b.id
            LIMIT 1
            """,
            (_validate_username(username),),
        ).fetchone()
        if row is None:
            return None

        try:
            parsed = json.loads(row["board_json"])
        except json.JSONDecodeError as exc:
            raise ValueError("stored board_json is invalid JSON") from exc
        return _validate_board_data(parsed)


__all__ = [
    "DEFAULT_DB_PATH",
    "MAX_BOARD_NAME_LEN",
    "MAX_CARD_DETAILS_LEN",
    "MAX_CARD_TITLE_LEN",
    "MAX_COLUMN_TITLE_LEN",
    "add_board_collaborator",
    "board_stats",
    "count_unread_notifications",
    "disable_board_share_token",
    "enable_board_share_token",
    "get_board_share_token",
    "get_public_board_by_token",
    "list_notifications",
    "mark_all_notifications_read",
    "mark_notification_read",
    "pin_board_for_user",
    "unpin_board_for_user",
    "create_board_for_user",
    "create_user",
    "delete_board_for_user",
    "duplicate_board_for_user",
    "get_board_for_user",
    "get_board_for_user_by_id",
    "get_connection",
    "get_user",
    "hash_password",
    "initialize_db",
    "list_activity_for_board",
    "list_board_collaborators",
    "list_boards_for_user",
    "list_user_tasks",
    "list_users",
    "record_activity",
    "search_user_content",
    "remove_board_collaborator",
    "update_board_for_user",
    "update_user_display_name",
    "update_user_password",
    "upsert_board_for_user",
    "verify_password",
]
