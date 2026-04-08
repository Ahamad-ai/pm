# Database design (Part 5)

## Scope

For the MVP, each signed-in user has exactly one Kanban board. The board is stored as a single JSON blob in SQLite.

## SQLite schema

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  board_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Why JSON blob storage

- Matches current frontend board shape directly (`columns` + `cards`)
- Keeps MVP read/write logic simple
- Avoids early normalization overhead before API behavior is stable
- Still allows future migration to normalized tables if needed

## Data model shape in `board_json`

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"] }
  ],
  "cards": {
    "card-1": { "id": "card-1", "title": "Task", "details": "Details" }
  }
}
```

## Initialization and migration strategy

- DB path default: `data/pm.sqlite3`
- On every storage read/write, backend calls `initialize_db()`:
  - creates parent directory if missing
  - creates `users` and `boards` tables if missing
- This provides a safe create-if-missing flow for fresh local environments
- No destructive migration is required at this stage; future schema changes should be additive with explicit migration scripts

## Validation boundary

- Input board payloads are validated before persistence:
  - `columns` must be a list with `id`, `title`, `cardIds`
  - `cards` must be an object keyed by card id
  - every `column.cardIds[]` value must exist in `cards`
  - `card.id` must match the key
- Stored malformed JSON is rejected during read with explicit errors to prevent silent corruption propagation

## Multi-user readiness

- `users.username` is unique
- `boards.user_id` is unique, enforcing one board per user for MVP
- The schema naturally supports adding more users without structural changes
