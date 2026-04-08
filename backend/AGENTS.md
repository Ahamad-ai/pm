## Backend overview

`backend/` now contains the FastAPI app for Parts 2 through 8.

- `app/main.py`: FastAPI app entrypoint
  - `GET /` serves static frontend `index.html`
  - `GET /api/hello` returns a hello JSON payload
  - `GET /health` returns service health status
  - `GET /api/board` returns board JSON for `X-Username` (auto-seeds default board if missing)
  - `PUT /api/board` validates and persists board JSON for `X-Username`
  - `POST /api/chat` sends board + conversation context to OpenRouter and returns validated structured output
- `app/schemas.py`: Pydantic request/response models for board APIs
- `app/board_service.py`: board-level service methods for get/create/save flow
- `app/default_board.py`: seeded board payload used when a user has no stored board
- `app/openrouter.py`: reusable OpenRouter client for structured chat completions
- `app/db.py`: SQLite storage layer for user boards
  - `initialize_db()`: create-if-missing DB + tables
  - `upsert_board_for_user()`: validate and store a board JSON blob for a user
  - `get_board_for_user()`: load and validate a user's board JSON blob
- `app/static/index.html`: fallback placeholder page used only when frontend build output is unavailable
- `tests/test_main.py`: API + static serving tests using `fastapi.testclient`
- `tests/test_db.py`: DB initialization, CRUD, and validation boundary tests
- `tests/test_board_service.py`: service-layer unit tests
- `tests/test_board_api.py`: API integration tests (auth header, CRUD, error paths, persistence)
- `tests/test_chat_api.py`: chat route validation and key-configuration tests
- `tests/test_openrouter.py`: prompt assembly and schema-shape tests for structured output flow
- `requirements.txt`: runtime dependencies
- `requirements-dev.txt`: test dependencies

Part 3 serving strategy:

- In Docker, frontend is built (`frontend/out`) in a Node build stage
- Python runtime image copies `frontend/out` and FastAPI serves it at `/`
- If `PM_STATIC_DIR` is set, backend serves static content from that path (useful for tests/local overrides)
- `PM_DB_PATH` can override SQLite location