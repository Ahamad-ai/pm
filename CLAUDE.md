# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A local, Dockerized project management app with multi-user accounts, multiple
Kanban boards per user, board sharing with viewer/editor collaborators, and an
AI chat sidebar. Cards support priority, due dates, labels, assignee, and
sub-task checklists. The board view includes search and filter
(priority/label/assignee/overdue), a board statistics strip, board JSON
export, and markdown rendering in card details. Each board change is recorded
in an activity log surfaced via a panel in the UI. Users can edit their
display name and change their password from the settings menu. The AI chat
(via OpenRouter) can read and modify the active board.

The legacy demo login `user` / `password` is still seeded automatically on
first start so the app works out of the box, but new users can register their
own accounts.

## Commands

### Run the app (Docker)

```bash
./scripts/start-mac.sh    # builds image + starts container on :8000
./scripts/stop-mac.sh     # stops container
```

App URL: http://localhost:8000

### Backend tests

```bash
python3 -m pytest backend/tests           # all backend tests
python3 -m pytest backend/tests/test_db.py # single test file
```

Dev dependencies: `pip install -r backend/requirements-dev.txt` (pytest, httpx)

### Frontend unit tests (Vitest)

```bash
cd frontend && npm install
npm run test:unit              # run once
npm run test:unit:watch        # watch mode
```

### Frontend e2e tests (Playwright)

```bash
cd frontend
npm run test:e2e               # against Next.js dev server on :3000
npm run test:e2e:backend       # against backend-served static app on :8000
```

### Frontend dev server

```bash
cd frontend && npm run dev     # Next.js dev on :3000
```

### Build & lint

```bash
cd frontend && npm run build   # Next.js static export to frontend/out/
cd frontend && npm run lint    # ESLint
```

## Architecture

### Two-layer stack

- **Frontend**: Next.js static export (React 19, TypeScript, Tailwind v4,
  `@dnd-kit` for drag-and-drop). Exported to `frontend/out/` and served by
  the backend.
- **Backend**: Python FastAPI (`backend/app/main.py`). Serves both the API
  and the static frontend. Uses `uv` as package manager inside Docker.

### Data model (SQLite)

- `users(id, username, password_hash, display_name, role, created_at)` —
  passwords hashed with `hashlib.scrypt` (stdlib).
- `boards(id, user_id, name, board_json, position, created_at, updated_at)` —
  many boards per user (where `user_id` is the **owner**), each board's
  columns/cards stored as a JSON blob.
- `board_collaborators(id, board_id, user_id, role, created_at)` — viewer or
  editor sharing on a board (UNIQUE on `board_id, user_id`).
- `activity_log(id, user_id, board_id, action, details, created_at)` —
  records `board.created`, `board.renamed`, `board.updated`,
  `board.ai_updated`, `board.collaborator_added`, `board.collaborator_removed`.

The schema is created (and migrated forward from the original single-board
schema) automatically on app startup.

Board JSON shape:
`{ columns: Column[], cards: Record<string, Card> }` where `Card` may include
optional `priority` (`low|medium|high|urgent`), `dueDate` (`YYYY-MM-DD`),
`labels` (string[]), `assignee` (string), `createdAt` (ISO string), and
`subtasks` (`{id, title, done}[]` — max 50 per card).

### Key backend modules

- `backend/app/main.py` -- FastAPI app factory (`create_app`), wires all routers
- `backend/app/db.py` -- SQLite connection, schema init/migration, password
  hashing, user CRUD, board CRUD, activity log helpers
- `backend/app/auth.py` -- JWT issue/verify, password-checking login,
  registration helper, demo-user seeding
- `backend/app/board_service.py` -- get/create/save helpers and chat-board
  resolution
- `backend/app/board_patch.py` -- merge AI-generated patches into existing boards
- `backend/app/openrouter.py` -- OpenRouter HTTP calls with structured JSON output
- `backend/app/schemas.py` -- Pydantic models for API requests/responses
- `backend/app/routes/*.py` -- per-domain routers (`login`, `board` legacy,
  `boards` new multi-board CRUD, `chat`, `health`)

### Key frontend modules

- `frontend/src/app/page.tsx` -- entry point, renders `AuthShell`
- `frontend/src/components/AuthShell.tsx` -- login + register form, gates
  access to the boards
- `frontend/src/components/BackendKanbanBoard.tsx` -- loads boards list,
  manages active board, persists changes, chat state
- `frontend/src/components/BoardSwitcher.tsx` -- dropdown to switch / create /
  rename / delete boards
- `frontend/src/components/KanbanBoard.tsx` -- board rendering with dnd-kit
- `frontend/src/components/KanbanCard.tsx` -- card rendering and inline editor,
  including priority/due-date/labels/assignee
- `frontend/src/components/ChatSidebar.tsx` -- AI chat panel
- `frontend/src/lib/kanban.ts` -- board types, `moveCard`, priority helpers,
  `isOverdue`, `createId`
- `frontend/src/lib/boardApi.ts` -- API client for legacy and new endpoints
- `frontend/src/lib/auth.ts` -- login / register / token helpers

### API routes

All board/chat routes require an `Authorization: Bearer <token>` header (or
the legacy `X-Username` for tests).

- `GET  /health` — health check
- `POST /api/login` — `{username, password}` → `{token, username, display_name, role}`
- `POST /api/register` — `{username, password, display_name?}` → same shape
- `GET  /api/users/me` — current user profile
- `PUT  /api/users/me` — update display name (`{display_name}`)
- `POST /api/users/me/password` — change password (`{current_password, new_password}`); returns a fresh token
- Legacy single-board (kept for backwards compatibility):
  - `GET  /api/board` — get/create the user's first board
  - `PUT  /api/board` — save the user's first board
- Multi-board CRUD:
  - `GET    /api/boards` — list the user's boards
  - `POST   /api/boards` — create a new board (`{name, board?}`)
  - `GET    /api/boards/{id}` — fetch one board with its full data
  - `PUT    /api/boards/{id}` — update name and/or board data
  - `DELETE /api/boards/{id}` — delete a board
  - `GET    /api/boards/{id}/activity` — last 50 activity entries
  - `GET    /api/boards/{id}/stats` — card counts by priority/column, overdue, sub-tasks
  - `GET    /api/boards/{id}/export` — JSON download (Content-Disposition attachment)
  - `GET    /api/boards/{id}/collaborators` — list current collaborators
  - `POST   /api/boards/{id}/collaborators` — owner-only invite (`{username, role}`)
  - `DELETE /api/boards/{id}/collaborators/{username}` — owner-only remove

Access is role-based: owner can do anything; editors can update card/column data
but cannot rename/delete the board or manage collaborators; viewers are
read-only. Activity is visible to all members.
- AI chat:
  - `POST /api/chat` — `{message, conversation_history, board_id?}` → assistant
    message + (optionally updated) board

### AI chat flow

`POST /api/chat` sends the active board + user message to OpenRouter with a
structured JSON output schema. The AI response includes `assistant_message`
and optional `board_update`. Board updates are patch-merged (not replaced)
via `apply_board_update_patch`. If a `board_id` is supplied, the update
applies to that specific board; otherwise the user's first board is used.

## Coding standards (from AGENTS.md)

- Use latest library versions and idiomatic patterns
- Keep it simple -- no over-engineering, no unnecessary defensive programming, no extra features
- Be concise. No emojis ever
- When hitting issues, identify root cause before trying a fix. Prove with evidence, then fix

## Color scheme

- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991`
- Dark Navy: `#032147`
- Gray Text: `#888888`

## Environment

- `OPENROUTER_API_KEY` must be set in root `.env`
- `PM_JWT_SECRET` should be set for production (defaults to a dev secret)
- Backend reads `.env` via `python-dotenv`
- Docker scripts pass `.env` into the container automatically
- SQLite DB auto-creates at `data/pm.sqlite3` if missing
- `PM_STATIC_DIR` and `PM_DB_PATH` env vars override defaults
