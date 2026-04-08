# Project Management MVP

This repository contains a local, Dockerized project management app with:

- fake sign-in (`user` / `password`)
- single-user Kanban board with drag/drop, add, edit, and drop card actions
- backend persistence in SQLite (one board JSON blob per user)
- AI chat sidebar that can update the board via OpenRouter

## Tech stack

- Frontend: Next.js (static export), React, TypeScript
- Backend: FastAPI (serves API and static frontend)
- Database: SQLite
- AI: OpenRouter using `openai/gpt-oss-120b:free`
- Packaging/runtime: Docker

## Prerequisites

- Docker
- `OPENROUTER_API_KEY` in root `.env`

Example `.env`:

```bash
OPENROUTER_API_KEY=your_key_here
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

Login:

- Username: `user`
- Password: `password`

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

- `GET /health`
- `GET /api/board` (requires `X-Username`)
- `PUT /api/board` (requires `X-Username`)
- `POST /api/chat` (requires `X-Username`)

## Notes

- The backend auto-creates the SQLite DB if missing.
- Start scripts pass `.env` into Docker automatically when present.
- Full plan and delivery checklist live in `docs/PLAN.md`.
