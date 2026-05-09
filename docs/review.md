# Code Review

Scope: full repository (backend FastAPI app, frontend Next.js app, Docker/scripts, tests). Severity is from a real-world deployment perspective; this is acknowledged as a single-user MVP, so some items are flagged for awareness rather than as ship-blockers.

## Summary

The codebase is small, readable, and well-organised for its scope. Module boundaries are clean (routes, service, db, schemas), Pydantic models are used consistently, and the patch-merge approach for AI board updates is a good design choice. Test coverage exists for both backend and frontend, including concurrency and e2e.

The main concerns sit at the auth boundary. Authentication is effectively bypassable in three independent ways, and one of the data sanitisation choices (`html.escape` at write time) is actively destructive to user content. Beyond that there are a handful of correctness, performance, and hygiene items.

---

## Critical

### 1. Login fallback authenticates on backend failure
`frontend/src/components/AuthShell.tsx:50-58`

If `login()` throws for any reason (network, 401, 500), the catch block sets `AUTH_STORAGE_KEY = "true"` and admits the user anyway. The comment says "Backend unavailable -- fall back to client-only auth" but the same path runs on a 401, so the backend's rejection is silently overridden.

Fix: only fall through on network errors that genuinely indicate the backend is unreachable, and never on a non-2xx response. Better: drop the fallback and require backend success.

### 2. `require_username` trusts any `X-Username` header
`backend/app/dependencies.py:13-14`

When no `Authorization: Bearer ...` header is present, the server accepts whatever username the client sends. A request with `X-Username: anyone` returns or creates a board for that user with no token at all. Combined with item 1, the JWT path is decorative.

Fix: drop the `X-Username` fallback in production paths, or gate it behind an explicit dev flag. The frontend should always send the token.

### 3. JWT secret has an insecure default
`backend/app/auth.py:14-18`

If `PM_JWT_SECRET` is unset, the code falls back to the literal string `"pm-mvp-dev-secret-not-for-production"`. Anyone reading this repo can sign valid tokens against any deployment that forgot to set the env var.

Fix: refuse to start when the env var is missing in non-development mode (e.g. fail fast unless `PM_ENV=development`).

### 4. `html.escape` at storage time mangles user content
`backend/app/db.py:15-16, 96-117`

`_sanitize_string` HTML-escapes column titles, card titles, and details on the way *into* SQLite. The frontend renders these as React text, which already escapes — so users see literal `&#x27;`, `&amp;`, `&lt;` after a roundtrip. Typing `Don't` in a column title becomes `Don&#x27;t` after a save.

Fix: store raw user text. Escape (or sanitise) on render, not on storage. React already escapes plain text; `react-markdown` already disables raw HTML by default. If defence-in-depth is wanted, sanitise the AI's structured response before merging — not user input.

---

## High

### 5. AI patch merge silently orphans cards
`backend/app/board_patch.py:42-49`

When the AI returns a column update, the candidate's `cardIds` *replaces* the existing column's `cardIds` (rather than merging). Cards still exist in `merged_cards`, but the only column referencing them no longer does. The downstream `_validate_board_data` then accepts this state because the orphan cards just sit in `cards` unreferenced — they vanish from the board UI.

Fix: decide on patch semantics explicitly. Either (a) treat candidate `cardIds` as authoritative for that column and require the AI to send the full intended order, or (b) merge by union. Document the choice in the system prompt and the schema.

### 6. Login route is unauthenticated and unrate-limited
`backend/app/routes/login.py`

Only `/api/chat` is rate-limited. `/api/login` accepts unlimited attempts. Even with a single demo credential, this is the wrong default; if the credential set ever grows, brute-force is uncapped.

Fix: apply `@limiter.limit("5/minute")` to login, keyed by IP.

### 7. Login route uses `payload: dict` instead of a Pydantic model
`backend/app/routes/login.py:9`

Skips schema validation, accepts arbitrary shapes, and silently coerces missing fields to empty strings. Inconsistent with every other route.

Fix: add `LoginRequest(BaseModel)` to `schemas.py` and use it.

### 8. Column rename fires a PUT per keystroke
`frontend/src/components/KanbanColumn.tsx:44-49` -> `BackendKanbanBoard.tsx:58-61`

Every change event on the title input updates state and immediately persists. Renaming a column from "Backlog" to "Discovery" sends ~9 PUTs in a few seconds. This also amplifies item 5 (rapid sequential PUTs racing each other).

Fix: debounce persistence (e.g. 400ms), or only persist on blur/Enter. The same pattern already works correctly for inline card editing (commit on Save).

### 9. Concurrent saves can land out of order
`frontend/src/components/BackendKanbanBoard.tsx:40-56`

`saveRequestIdRef` correctly drops stale UI feedback, but the requests themselves race over the network. With browser HTTP/1.1 connection reuse this is usually fine, but with HTTP/2 multiplexing or a slow backend it is not — the older request can settle last and overwrite the newer state.

Fix: serialise saves (queue the next save, drop intermediate states), or ignore the response of stale requests *and* abort them via `AbortController`.

---

## Medium

### 10. Frontend always sends `DEMO_USERNAME`
`frontend/src/components/BackendKanbanBoard.tsx:25,46,72`

Even if the backend supported multiple users, the FE hardcodes `DEMO_USERNAME` for every API call instead of reading from the JWT subject or the login response. Locks the app to single-user even if the server is fixed.

Fix: persist the logged-in username alongside the token and pass it through.

### 11. `_extract_first_json_object` is a brittle JSON parser
`backend/app/openrouter.py:106-132`

Counts `{` / `}` without tracking string state. A model that emits `}` inside a string (e.g. inside `details`) will be misparsed. Today this is shielded by `response_format: json_schema`, but if that ever gets weakened (e.g. a model that doesn't honour it) the heuristic fails silently.

Fix: trust `response_format` and let `json.loads` do the work. If you need a fallback, strip code fences and parse — don't reimplement bracket matching.

### 12. `initialize_db` runs on every read and write
`backend/app/db.py:126,149`

`CREATE TABLE IF NOT EXISTS` is cheap but not free, and it opens an extra connection per call. Every board GET/PUT does it twice (once to init, once to read).

Fix: run schema init once at app startup via FastAPI's `lifespan`, then drop the calls from `get_board_for_user` / `upsert_board_for_user`.

### 13. SQLite connections are not explicitly closed
`backend/app/db.py:19-25`

`with get_connection(...)` commits/rolls back via the connection's `__exit__`, but the connection itself isn't closed — sqlite3's context manager only manages the transaction. Under heavy testing or long-running processes this leaks file handles.

Fix: wrap in `contextlib.closing(...)` or use a small `@contextmanager` helper that calls `close()` in `finally`.

### 14. Chat retry strategy quietly discards conversation history
`backend/app/routes/chat.py:33-58`

If the first structured-output validation fails, the retry sends an empty history. The user gets a response, but it's context-free, and there's no signal that history was dropped.

Fix: log it more visibly, and consider only retrying when validation failure is plausibly history-related (e.g. token-budget overflow). Otherwise just surface the error.

### 15. `apply_board_update_patch` doesn't validate inputs but its callers don't strictly trust it either
`backend/app/board_patch.py`

The function is permissive (returns one or the other side on shape mismatch) and the result is then run through `_validate_board_data` in `upsert_board_for_user`. That works, but the layering is fuzzy — the patch function partly validates, partly defers. Move all validation to one place; keep the patch function purely structural.

### 16. CORS configuration risk
`backend/app/main.py:39-46`

`allow_credentials=True` with `allow_origins=[]` is currently safe (no cross-origin allowed at all), but if anyone later sets `PM_CORS_ORIGINS=*`, FastAPI's middleware will reject the combination at runtime (`*` + credentials is invalid). Worth a comment, or stricter validation that explicit origins are required.

---

## Low

### 17. `requirements.txt` lists `httpx` twice
`backend/requirements.txt:2,4`

Cosmetic, but worth tidying. Also: no version pinning anywhere — fine for a personal MVP, but `uv lock` / `pip-compile` would prevent surprise breakage.

### 18. Logout button position is hard-coded to sidebar width
`frontend/src/components/AuthShell.tsx:135`

`fixed right-[392px]` is `360px sidebar + 4px inset + ~28px gap`. Any sidebar width change silently breaks alignment.

Fix: use a CSS variable for sidebar width, or position the logout button inside `BackendKanbanBoard`'s layout grid.

### 19. `KanbanBoard` has a confusing controlled-vs-internal split
`frontend/src/components/KanbanBoard.tsx:25-52`

The component supports both an uncontrolled mode (`internalBoard`) and a controlled mode. In production it is always controlled. The dual mode appears to exist for the unit test of the bare board component. It's load-bearing for tests but adds non-trivial branching.

Fix: split into a controlled `KanbanBoard` and a thin `KanbanBoardWithLocalState` test wrapper, or just push state up always.

### 20. `KanbanCard` pointer listeners cover the entire card
`frontend/src/components/KanbanCard.tsx:46-49`

Edit and Delete buttons live inside the same article that has dnd-kit's pointer listeners. The 6px PointerSensor activation distance prevents accidental drags on click, but on a touch device a small finger movement during tap can register as drag-start.

Fix: bind drag listeners only to a dedicated handle (e.g. a grip area at the top of the card).

### 21. `DEFAULT_BOARD` duplicated across backend and frontend
`backend/app/default_board.py` and `frontend/src/lib/kanban.ts:18-72`

Identical seed data in two places. The frontend copy is only used when the backend is unreachable. Drift is inevitable.

Fix: have the frontend's offline mode show an empty board with a banner, and let the backend own the seed.

### 22. `get_openrouter_api_key` raises 500 with a leaky message
`backend/app/openrouter.py:21-25`

Server misconfiguration is reported to the client as 500 with `OPENROUTER_API_KEY is not configured`. Reasonable for a single-user MVP, but in any larger context this leaks operational detail.

Fix: log internally, return 503 with a generic message.

### 23. `_sanitize_string` truncates pre-escape
`backend/app/db.py:15-16`

Slicing the raw string then escaping means the post-escape length can exceed `max_length` (a single `&` becomes `&amp;`). Not a bug, but `MAX_*_LEN` is no longer the actual stored size.

This becomes moot once item 4 is fixed (no escape at storage).

### 24. Health endpoint also exposes `/api/hello`
`backend/app/routes/health.py:21-23`

Looks like a leftover scaffold endpoint. Harmless but should be removed.

### 25. No structured logging
Only one `logger.warning` in `chat.py`. There's no app-level logging configuration, so production debugging means stdout from uvicorn.

Fix: configure logging in `create_app` with a `JSONFormatter` or at least named loggers per module.

---

## Positive notes

- The patch-merge architecture for AI board updates is the right call: it limits the blast radius of a hallucinating model.
- Pydantic schemas are used end-to-end on the typed routes; request/response contracts are explicit.
- The frontend correctly separates board rendering (`KanbanBoard`) from data orchestration (`BackendKanbanBoard`).
- `apply_board_update_patch` correctly prunes dead `cardIds` references before saving.
- `BEGIN IMMEDIATE` on the upsert path is the right concurrency choice for SQLite.
- Tests exist for the unhappy paths (concurrency, openrouter parsing, validation errors). That's more than most MVPs ship with.
- The Dockerfile uses a non-root user and a multi-stage build. Good defaults.

---

## Suggested priority order

1. Fix items 1, 2, 3 together — they form a single auth bypass.
2. Fix item 4 (`html.escape`) — actively corrupting user data.
3. Fix items 5 and 8 — both directly degrade the AI/board experience.
4. Fix items 6, 7 (login hardening), then 9-15 as time permits.
5. Items 16-25 are cleanup; group them with the next refactor pass.
