from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


def test_health_endpoint(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<h1>Kanban Studio</h1>")
    client = TestClient(create_app(static_dir=tmp_path))
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_hello_endpoint(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<h1>Kanban Studio</h1>")
    client = TestClient(create_app(static_dir=tmp_path))
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello from FastAPI"}


def test_index_serves_static_html() -> None:
    static_dir = Path(__file__).resolve().parents[2] / "frontend" / "out"
    if not static_dir.exists():
        pytest.skip("frontend/out does not exist; run frontend build first")
    client = TestClient(create_app(static_dir=static_dir))
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Kanban Studio" in response.text


def test_missing_frontend_build_returns_404(tmp_path: Path) -> None:
    client = TestClient(create_app(static_dir=tmp_path))
    response = client.get("/")
    assert response.status_code == 404
