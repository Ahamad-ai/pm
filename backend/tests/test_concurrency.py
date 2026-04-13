import threading
from pathlib import Path

from backend.app.board_service import get_or_create_board_for_user, save_board_for_user


def _make_board(title: str) -> dict:
    return {
        "columns": [{"id": "col-a", "title": "Backlog", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": title, "details": "d"}},
    }


def test_concurrent_saves_do_not_corrupt_db(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    get_or_create_board_for_user("user", db_path)

    errors: list[Exception] = []

    def save_board(i: int) -> None:
        try:
            save_board_for_user("user", _make_board(f"Task {i}"), db_path)
        except Exception as exc:
            errors.append(exc)

    threads = [threading.Thread(target=save_board, args=(i,)) for i in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Concurrent saves produced errors: {errors}"

    # Board should be readable and valid after concurrent writes
    board = get_or_create_board_for_user("user", db_path)
    assert isinstance(board["columns"], list)
    assert isinstance(board["cards"], dict)


def test_concurrent_different_users(tmp_path: Path) -> None:
    db_path = tmp_path / "pm.sqlite3"
    errors: list[Exception] = []

    def save_board(username: str) -> None:
        try:
            save_board_for_user(username, _make_board(f"Task for {username}"), db_path)
        except Exception as exc:
            errors.append(exc)

    threads = [
        threading.Thread(target=save_board, args=(f"user-{i}",)) for i in range(10)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0, f"Concurrent user creates produced errors: {errors}"

    for i in range(10):
        board = get_or_create_board_for_user(f"user-{i}", db_path)
        assert board["cards"]["card-1"]["title"] == f"Task for user-{i}"
