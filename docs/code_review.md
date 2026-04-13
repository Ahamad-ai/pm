# Code Review Report

Comprehensive review of the PM MVP repository covering backend, frontend, security, infrastructure, and test quality.

---

## Critical

### 1. Race condition in board save-then-read

**File:** `backend/app/board_service.py:21-28`

`save_board_for_user()` calls `upsert_board_for_user()` then immediately calls `get_board_for_user()` in a separate connection. Concurrent requests from the same user can interleave, causing one request to read stale data after another's write.

**Action:** Restructure `upsert_board_for_user()` to return the persisted board directly within the same transaction, eliminating the separate read.

### 2. Missing database transaction isolation

**File:** `backend/app/db.py:108-121`

`_ensure_user()` and the board upsert are not wrapped in an explicit transaction. Concurrent writers can race on user creation or board update.

**Action:** Use `BEGIN IMMEDIATE` to serialize competing writers within `upsert_board_for_user()`.

---

## High

### 3. X-Username header spoofing

**File:** `backend/app/main.py:45-51`

User identity is determined solely by the `X-Username` header. Any client can set any username and access/modify other users' boards.

**Action:** Even for MVP, tie the header to a validated session token (JWT or secure cookie) issued at login time.

### 4. No CORS middleware configured

**File:** `backend/app/main.py:154-237`

No CORS policy is set. If frontend and backend are ever served from different origins, cross-origin requests will fail silently. Missing security headers also leave the app open to cross-origin attacks.

**Action:** Add `CORSMiddleware` with explicit allowed origins, methods, and headers.

### 5. No rate limiting on AI endpoint

**File:** `backend/app/main.py:189-230` (`POST /api/chat`)

The OpenRouter chat endpoint has no rate limiting. Attackers can spam it to exhaust API quota and incur costs.

**Action:** Add per-user rate limiting (e.g., `slowapi` with 5-10 requests/minute).

### 6. AI response content not sanitized

**File:** `backend/app/openrouter.py:106-143`, `backend/app/main.py:54-123`

AI-generated card titles and details are validated for type/structure but not for content. Malicious or hallucinated AI output could contain XSS payloads, extremely long strings, or special characters that break the frontend.

**Action:**
- Sanitize HTML in AI-generated strings before storage (`html.escape()` or `bleach`)
- Enforce max length on card titles (100 chars) and details (500 chars)

### 7. Chat history race condition in frontend

**File:** `frontend/src/components/BackendKanbanBoard.tsx:63-65`

`handleSendChat` captures `conversationHistory` from `chatMessages` state before appending the new user message. If two messages are sent quickly, the second call's history won't include the first user message.

**Action:** Pass `[...chatMessages, { role: "user", content: message }]` to `sendChat` instead of the pre-snapshot `conversationHistory`.

### 8. Missing null check on AI board response

**File:** `frontend/src/components/BackendKanbanBoard.tsx:74`

If `sendChat` succeeds but `response.board` is undefined or null, `setBoard(response.board)` overwrites state with undefined, crashing the UI.

**Action:** Guard with `if (response.board) setBoard(response.board)`.

### 9. No tests for boardApi.ts or ChatSidebar

**Files:** `frontend/src/lib/boardApi.ts`, `frontend/src/components/ChatSidebar.tsx`

The API client layer (`fetchBoard`, `saveBoard`, `sendChat`) has zero tests. `ChatSidebar` -- the AI chat UI -- also has no tests. These are core MVP features with no coverage.

**Action:** Add unit tests for API client error handling (network errors, 4xx/5xx responses, malformed bodies) and ChatSidebar states (loading, error, message rendering).

---

## Medium

### 10. Silent error swallowing in chat retry

**File:** `backend/app/main.py:133-151`

When `request_validated_structured_chat()` fails validation on first attempt, it silently retries with empty history. If both fail, a generic 502 is returned with no logging. Operators have no visibility into failure frequency or causes.

**Action:** Log the `ValidationError` details before retry. Include error context in the 502 detail.

### 11. Incorrect HTTP status for AI validation failures

**File:** `backend/app/main.py:220-224`

AI board_update validation failures return 502 (Bad Gateway), implying an upstream infrastructure issue. The actual problem is invalid data from the AI model.

**Action:** Return 422 (Unprocessable Entity) for AI responses that fail board validation.

### 12. Docker container runs as root

**File:** `Dockerfile:9`

No `USER` directive means the container runs as root. If compromised, the attacker has full system access inside the container.

**Action:** Add a non-root user:
```dockerfile
RUN useradd -m -u 1000 appuser
USER appuser
```

### 13. Health endpoint does not check database

**File:** `backend/app/main.py:163-165`

`/health` returns `{"status": "ok"}` unconditionally. Container orchestrators will report healthy even if the database is unreachable.

**Action:** Add a DB connectivity check inside the health endpoint; return 503 on failure.

### 14. Weak ID generation in frontend

**File:** `frontend/src/lib/kanban.ts:164-168`

`createId()` uses `Math.random()` which is not cryptographically random and has collision risk at scale.

**Action:** Replace with `crypto.randomUUID()`.

### 15. Database path traversal via env var

**File:** `backend/app/db.py:10-16`

`PM_DB_PATH` env var is used without validation. A crafted value could write the database outside the project directory.

**Action:** Validate that the resolved path is within the project root using `Path.is_relative_to()`.

### 16. Unsafe type casts in drag-and-drop

**File:** `frontend/src/components/KanbanBoard.tsx:48-49, 62`

`event.active.id as string` casts without checking. DndKit IDs could be numbers or other types.

**Action:** Add runtime type guards before casting.

### 17. Missing drag-and-drop accessibility

**Files:** `frontend/src/components/KanbanBoard.tsx`, `KanbanColumn.tsx`

No ARIA live regions or screen reader announcements for drag-and-drop operations. Keyboard-only and screen reader users cannot use the board effectively.

**Action:** Add `aria-live="polite"` regions to announce drag state changes. Consider using `@dnd-kit/accessibility` utilities.

### 18. Missing moveCard edge case tests

**File:** `frontend/src/lib/kanban.test.ts`

`moveCard()` has 3 tests but does not cover: moving non-existent cards, empty columns, or the `oldIndex === newIndex` no-op path.

**Action:** Add edge case tests for these paths.

### 19. No concurrency tests in backend

**File:** `backend/tests/` (all files)

No tests cover concurrent requests to the same user's board. The race conditions in items 1 and 2 would not be caught.

**Action:** Add `pytest-asyncio` tests with multiple requests racing on the same board.

---

## Low

### 20. Fragile string conversion in DB read

**File:** `backend/app/db.py:142`

`json.loads(str(row["board_json"]))` -- the `str()` call is redundant since SQLite returns TEXT columns as strings. It could mask encoding issues.

**Action:** Use `json.loads(row["board_json"])` directly.

### 21. Chat message list uses array index as key

**File:** `frontend/src/components/ChatSidebar.tsx:56-67`

Messages use `key={role-index}` which can cause DOM reuse bugs when messages are added or reordered.

**Action:** Add a unique ID or timestamp to each message and use it as key.

### 22. Hydration mismatch risk in AuthShell

**File:** `frontend/src/components/AuthShell.tsx:45-46`

Returning `null` before `isReady` can cause Next.js hydration warnings since the server renders nothing but the client expects content.

**Action:** Return a loading skeleton with matching DOM structure instead of null.

### 23. E2E drag-drop uses brittle mouse coordinates

**File:** `frontend/tests/kanban.spec.ts:36-47`

Manual mouse coordinate offsets for drag-and-drop are fragile and will break if layout changes.

**Action:** Use Playwright's `dragTo()` API targeting element locators instead of hardcoded coordinates.

### 24. Missing E2E coverage for card editing and column rename

**Files:** `frontend/tests/kanban.spec.ts`, `frontend/tests-backend/kanban.backend.spec.ts`

No E2E tests cover editing existing cards, renaming columns, or verifying AI board updates persist after reload.

**Action:** Add E2E tests for these user flows.

### 25. Dependency versions not pinned

**File:** `frontend/package.json`

All dependencies use `^` ranges (e.g., `"next": "16.1.6"` is actually `^16.1.6` in resolved form). Minor version bumps can introduce breaking changes.

**Action:** Pin exact versions or use a lockfile strategy with periodic controlled upgrades.

---

## Summary

| Severity | Count | Key themes |
|----------|-------|------------|
| Critical | 2     | Database race conditions and transaction isolation |
| High     | 7     | Auth spoofing, missing CORS/rate limiting, AI content injection, frontend state bugs, missing tests |
| Medium   | 10    | Error handling, Docker security, accessibility, type safety |
| Low      | 6     | Test fragility, hydration, key props, dependency pinning |

### Recommended priority order

1. Fix database race condition and transaction isolation (items 1, 2)
2. Add CORS middleware and rate limiting (items 4, 5)
3. Sanitize AI-generated content (item 6)
4. Fix frontend state bugs (items 7, 8)
5. Add missing test coverage (items 9, 18, 19, 24)
6. Address Docker and infrastructure gaps (items 12, 13, 15)
7. Remaining medium and low items
