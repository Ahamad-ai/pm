# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A local, Dockerized project management app with a Kanban board and AI chat sidebar. Single-user MVP with hardcoded login (`user` / `password`). The AI chat (via OpenRouter) can read and modify the board.

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

- **Frontend**: Next.js static export (React 19, TypeScript, Tailwind v4, `@dnd-kit` for drag-and-drop). Exported to `frontend/out/` and served by the backend.
- **Backend**: Python FastAPI (`backend/app/main.py`). Serves both the API and the static frontend. Uses `uv` as package manager inside Docker.

### Data flow

The board is a single JSON blob per user stored in SQLite (`data/pm.sqlite3`). The schema has two tables: `users` and `boards` (one board per user, stored as `board_json` TEXT).

Board shape: `{ columns: Column[], cards: Record<string, Card> }` where each column holds `cardIds` referencing keys in the `cards` map.

### Key backend modules

- `backend/app/main.py` -- FastAPI app factory (`create_app`), API routes, board patch-merge logic (`apply_board_update_patch`)
- `backend/app/db.py` -- SQLite connection, schema init, board CRUD
- `backend/app/board_service.py` -- get-or-create and save helpers (seeds default board on first access)
- `backend/app/openrouter.py` -- OpenRouter HTTP calls with structured JSON output schema
- `backend/app/schemas.py` -- Pydantic models for API request/response validation

### Key frontend modules

- `frontend/src/app/page.tsx` -- entry point, renders `AuthShell`
- `frontend/src/components/AuthShell.tsx` -- login form, gates access to the board
- `frontend/src/components/BackendKanbanBoard.tsx` -- fetches/saves board via API, manages chat state
- `frontend/src/components/KanbanBoard.tsx` -- board rendering with dnd-kit
- `frontend/src/components/ChatSidebar.tsx` -- AI chat panel
- `frontend/src/lib/kanban.ts` -- board types (`BoardData`, `Column`, `Card`), `moveCard` logic, `createId`
- `frontend/src/lib/boardApi.ts` -- API client (`fetchBoard`, `saveBoard`, `sendChat`)
- `frontend/src/lib/auth.ts` -- auth constants

### API routes

All board/chat routes require `X-Username` header.

- `GET /health` -- health check
- `GET /api/board` -- get or create board for user
- `PUT /api/board` -- save board
- `POST /api/chat` -- send message to AI, may return updated board

### AI chat flow

`POST /api/chat` sends the current board + user message to OpenRouter with a structured JSON output schema. The AI response includes `assistant_message` and optional `board_update`. Board updates are patch-merged (not replaced) via `apply_board_update_patch` in `main.py`.

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
- Backend reads `.env` via `python-dotenv`
- Docker scripts pass `.env` into the container automatically
- SQLite DB auto-creates at `data/pm.sqlite3` if missing
- `PM_STATIC_DIR` and `PM_DB_PATH` env vars override defaults
