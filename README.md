# Project Management MVP

A local, Dockerized project management app with:

- Multi-user accounts (registration + login, scrypt-hashed passwords)
- Profile editing and password change from the settings menu
- Multiple Kanban boards per user with create / rename / delete
- Cards with priority, due date, labels, assignee, and sub-task checklist
- Search & filter (priority, label, assignee, overdue-only)
- Drag-and-drop card movement, inline editing
- Board sharing with viewer/editor collaborators
- Per-board activity log with a UI panel
- Board statistics strip (cards, overdue, priorities, sub-task progress)
- Board JSON export
- Markdown rendering in card details
- AI chat sidebar (OpenRouter) that can update the active board

The legacy demo account `user` / `password` is auto-seeded on first start, so
the app is usable immediately. New users register their own accounts.

## Tech stack

- Frontend: Next.js 16 (static export), React 19, TypeScript, Tailwind v4
- Backend: FastAPI (serves API and static frontend), JWT auth
- Database: SQLite
- AI: OpenRouter using `openai/gpt-oss-120b:free`
- Packaging/runtime: Docker

## Prerequisites

- Docker
- `OPENROUTER_API_KEY` in root `.env`

Example `.env`:

```bash
OPENROUTER_API_KEY=your_key_here
PM_JWT_SECRET=set_this_in_production
```

## Run locally

From repo root:

### macOS

```bash
./scripts/start-mac.sh
```

Stop:

```bash
./scripts/stop-mac.sh
```

### Linux

```bash
./scripts/start-linux.sh
```

Stop:

```bash
./scripts/stop-linux.sh
```

### Windows (PowerShell)

```powershell
.\scripts\start-windows.ps1
```

Stop:

```powershell
.\scripts\stop-windows.ps1
```

App URL: `http://localhost:8000`

Demo login (auto-seeded):

- Username: `user`
- Password: `password`

Or register a new account from the sign-in screen.

## Test commands

### Backend

```bash
python3 -m pytest backend/tests
```

### Frontend unit

```bash
cd frontend
npm install
npm run test:unit
```

### Frontend e2e (frontend dev server)

```bash
cd frontend
npm run test:e2e
```

### Frontend e2e (backend-served app)

```bash
cd frontend
npm run test:e2e:backend
```

## Main API routes

All routes (except `/api/login`, `/api/register`, `/health`) require an
`Authorization: Bearer <token>` header. The legacy `X-Username` header is also
accepted to keep the simple single-board flow working.

- `GET  /health`
- `POST /api/login` — `{username, password}`
- `POST /api/register` — `{username, password, display_name?}`
- `GET  /api/users/me`, `PUT /api/users/me`, `POST /api/users/me/password`
- `GET  /api/boards` — list current user's boards
- `POST /api/boards` — create a new board
- `GET  /api/boards/{id}` — fetch one board with its full data
- `PUT  /api/boards/{id}` — rename and/or update a board
- `DELETE /api/boards/{id}` — delete a board
- `GET  /api/boards/{id}/activity` — recent activity entries
- `GET  /api/boards/{id}/stats` — card counts and progress
- `GET  /api/boards/{id}/export` — board JSON download
- `GET/POST /api/boards/{id}/collaborators`, `DELETE /api/boards/{id}/collaborators/{username}` — sharing
- `GET  /api/board`, `PUT /api/board` — legacy single-board endpoints
- `POST /api/chat` — chat with the AI (optional `board_id` to target a board)

## Notes

- The backend auto-creates and migrates the SQLite DB on startup.
- Passwords are hashed with `hashlib.scrypt` (Python stdlib) — no external
  hashing dependency required.
- Start scripts pass `.env` into Docker automatically when present.
- Full plan and delivery checklist live in `docs/PLAN.md`.
