import os
from pathlib import Path

from backend.app.db import DEFAULT_DB_PATH

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parents[1]
DEFAULT_STATIC_DIR = BASE_DIR / "static"
FRONTEND_OUT_DIR = PROJECT_ROOT / "frontend" / "out"


def resolve_static_dir() -> Path:
    env_path = os.getenv("PM_STATIC_DIR")
    if env_path:
        return Path(env_path)
    return FRONTEND_OUT_DIR if FRONTEND_OUT_DIR.exists() else DEFAULT_STATIC_DIR


def resolve_db_path() -> Path:
    env_path = os.getenv("PM_DB_PATH")
    if env_path:
        resolved = Path(env_path).resolve()
        if not resolved.is_relative_to(PROJECT_ROOT):
            raise ValueError(
                f"PM_DB_PATH must be within the project root ({PROJECT_ROOT})"
            )
        return resolved
    return DEFAULT_DB_PATH
