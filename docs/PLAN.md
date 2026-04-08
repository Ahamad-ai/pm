# Project Implementation Plan

This plan breaks the MVP into 10 parts with concrete checklists, tests, and success criteria.

## Global decisions (locked)

- Frontend: Next.js app in `frontend/`
- Backend: FastAPI in `backend/`
- Runtime: local Docker container for full app
- Python package manager in container: `uv`
- AI provider/model: OpenRouter with `openai/gpt-oss-120b:free`
- Persistence: SQLite, with **one JSON blob per user/board**
- AI responses in Part 9+: **strict structured output schema**, validated server-side
- Test expectation: **robust integration testing** in addition to focused unit tests

## Implemented design decisions (through Part 10)

- Frontend static serving: backend mounts exported frontend files at `/` and keeps `/static` for direct smoke checks.
- Fake auth: login is frontend-only with hardcoded credentials (`user` / `password`) and localStorage session flag.
- Backend user context for board APIs: current MVP uses `X-Username` request header (`/api/board` GET/PUT).
- Board API behavior: `GET /api/board` auto-seeds a default board for first-time users; `PUT /api/board` validates and persists full board JSON.
- DB path/runtime overrides: backend supports `PM_DB_PATH` and `PM_STATIC_DIR` env vars for test/runtime flexibility.
- Frontend board sync: UI is optimistic, persists each board mutation asynchronously to backend, and rehydrates from backend on load.
- Frontend resilience: if backend is unavailable during frontend-only runs, board falls back to local seeded data with a visible warning banner.
- AI chat route: `POST /api/chat` now returns validated structured JSON (Part 9) and includes optional persisted board updates.
- OpenRouter smoke policy: verify real provider connectivity with a live `2+2` call (no mocking).
- Part 9 context contract: every chat call sends current board JSON + user message + conversation history to the model.
- Part 10 chat UI: frontend uses a dedicated right sidebar widget, sends full conversation history to `/api/chat`, and applies returned board updates immediately.

## Part 8 decisions (confirmed)

- AI endpoint: use `POST /api/chat`
- Response mode: streaming response
- Connectivity verification: run a real end-to-end OpenRouter call (no mocking) and confirm model answer
- Implementation style: structure code for reuse in Parts 9 and 10

Note: the Part 8 streaming response mode was superseded in Part 9 by structured JSON responses to support validated board updates.

## Definition of done (applies to every part)

- [ ] Scope implemented with minimal complexity (no extra features)
- [ ] Automated tests added/updated and passing for impacted behavior
- [ ] Basic manual verification steps documented and run
- [ ] No regressions in existing test suites
- [ ] Docs updated for any behavior/runtime changes

---

## Part 1: Planning and documentation

### Checklist

- [x] Expand `docs/PLAN.md` with detailed, phase-by-phase execution
- [x] Add explicit testing and success criteria per part
- [x] Create `frontend/AGENTS.md` describing current frontend codebase

### Tests

- [x] Documentation review pass for clarity and completeness
- [x] Verify plan includes persistence and structured output decisions

### Success criteria

- [x] Plan is implementation-ready with no ambiguous phase goals
- [x] Frontend `AGENTS.md` gives enough context for future work without code spelunking

---

## Part 2: Scaffolding (Docker + FastAPI hello world)

### Checklist

- [x] Create FastAPI app scaffold in `backend/`
- [x] Add Dockerfile and any compose/runtime config needed
- [x] Add start/stop scripts for macOS, Windows, Linux in `scripts/`
- [x] Serve a static hello-world HTML page from backend
- [x] Add one sample API endpoint and wire the page to call it

### Tests

- [x] Backend unit test for sample API route
- [x] Integration test: container starts and serves both HTML and API
- [x] Script smoke tests for start/stop behavior

### Success criteria

- [x] `docker` run path works locally end-to-end
- [x] Browser shows hello world page and successful API response

---

## Part 3: Add frontend build + serving

### Checklist

- [x] Build frontend artifacts and serve through backend at `/`
- [x] Preserve current Kanban demo UX/functionality
- [x] Ensure static assets and routing work correctly when backend-served

### Tests

- [x] Frontend unit tests remain green
- [x] E2E test for loading board at `/` through backend
- [x] Integration test that verifies static build is served by FastAPI

### Success criteria

- [x] Kanban board is visible and interactive at `/` in full-stack runtime
- [x] No broken asset paths or route failures

---

## Part 4: Fake sign-in flow

### Checklist

- [x] Add login gate for `/` using hardcoded credentials: `user` / `password`
- [x] Add logout control and session clear behavior
- [x] Prevent board visibility until login succeeds

### Tests

- [x] Frontend unit tests for login form validation and auth state transitions
- [x] Integration test for protected route behavior
- [x] E2E tests: login success, login failure, logout, session-protected board access

### Success criteria

- [x] Unauthenticated users cannot access board UI
- [x] Authenticated users can access board and logout reliably

---

## Part 5: Database modeling (JSON blob design)

### Checklist

- [x] Define SQLite schema for users + single board per user
- [x] Store board state as one JSON blob per user/board record
- [x] Document schema and rationale in `docs/`
- [x] Document migration/initialization strategy for missing DB file

### Tests

- [x] Unit test for schema init/create-if-missing logic
- [x] Integration test for CRUD of JSON blob data
- [x] Validation tests for malformed JSON prevention at application boundary

### Success criteria

- [x] Schema supports MVP and future multi-user expansion
- [x] JSON blob persistence works reliably and is documented clearly

---

## Part 6: Backend Kanban APIs

### Checklist

- [x] Implement API routes to read/update board for signed-in user
- [x] Add request/response models and validation
- [x] Ensure DB auto-creates if missing
- [x] Handle happy path + expected invalid input errors

### Tests

- [x] Backend unit tests for service/repository functions
- [x] Integration tests for API routes against real SQLite file
- [x] Error-path tests (bad payload, missing user/session)

### Success criteria

- [x] API supports full MVP board read/update lifecycle
- [x] Data persists across app restart

---

## Part 7: Frontend + backend integration

### Checklist

- [x] Replace in-memory board state with backend API calls
- [x] Add loading/error UI states for fetch/mutation actions
- [x] Keep UX responsive for drag/drop and card edits

### Tests

- [x] Frontend unit tests for API-driven state transitions
- [x] Integration tests for client/backend interaction
- [x] E2E tests covering persistence across reloads

### Success criteria

- [x] Board changes persist and rehydrate from backend
- [x] Core interactions remain stable and intuitive

---

## Part 8: AI connectivity (OpenRouter smoke)

### Checklist

- [x] Add reusable backend AI client using OpenRouter API key from root `.env`
- [x] Implement `POST /api/chat` streaming route and verify `2+2` connectivity
- [x] Add timeout/error handling for external AI calls

### Tests

- [x] Unit tests for local route/error behavior (no external call mocking requirement)
- [x] Real integration smoke test against OpenRouter via `POST /api/chat` with `2+2`
- [x] Manual verification of streaming response behavior

### Success criteria

- [x] Backend can successfully call OpenRouter in supported env
- [x] Failures are handled without crashing API

---

## Part 9: AI structured outputs + Kanban context

### Checklist

- [x] Always send current board JSON + user message + conversation history to AI
- [x] Define strict structured output schema:
  - `assistant_message` (required string)
  - `board_update` (optional board JSON payload)
- [x] Validate AI output server-side before applying updates
- [x] Persist validated board updates to DB when present

### Tests

- [x] Unit tests for prompt assembly and structured output parsing
- [x] Unit tests for schema validation pass/fail cases
- [x] Integration tests for end-to-end AI response handling (mocked AI)
- [x] Integration tests proving invalid structured output is safely rejected

### Success criteria

- [x] AI responses are always schema-conformant before use
- [x] Optional board updates are applied atomically and persisted

---

## Part 10: AI sidebar in UI

### Checklist

- [x] Add sidebar chat UI integrated with backend AI endpoint
- [x] Show conversation history and assistant responses
- [x] Apply AI-provided board updates and refresh UI automatically
- [x] Preserve existing Kanban interactions and visual style

### Tests

- [x] Frontend unit tests for chat UI states and message rendering
- [x] Integration tests for chat send/receive + board update propagation
- [x] E2E tests for full user flow (login -> chat -> AI update -> board refresh)

### Success criteria

- [x] Sidebar chat is production-usable for MVP scope
- [x] AI-triggered board updates are visible immediately and persisted

---

## Test strategy by layer

- Unit tests: pure logic and component behavior with mocks
- Integration tests: service + API + DB boundaries with realistic wiring
- E2E tests: critical user journeys in running app
- Coverage target: aim for ~80% when sensible, prioritizing high-value assertions over coverage padding
- Keep tests deterministic; prefer mocks for third-party APIs and live smoke tests only when necessary

## Risks and mitigation

- AI output variance: enforce strict schema validation and safe fallback message
- Drag/drop + async persistence conflicts: update UI predictably and reconcile with server state
- Static serving path issues: add integration tests for asset/routing correctness in backend-served mode
- Environment drift in local Docker: document one canonical startup path via scripts