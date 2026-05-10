from backend.app.board_patch import apply_board_update_patch


def test_existing_card_fields_survive_when_ai_omits_them() -> None:
    """Regression: the merger used to do {**current, **candidate}, so any
    field the AI didn't return was wiped. Now we per-field merge."""
    current = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["card-1"]}],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "Old title",
                "details": "Old details",
                "priority": "high",
                "dueDate": "2026-12-31",
                "labels": ["release"],
                "assignee": "alice",
            }
        },
    }
    candidate = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["card-1"]}],
        "cards": {
            # AI rewrites only title/details — everything else must survive.
            "card-1": {
                "id": "card-1",
                "title": "New title",
                "details": "New details",
            }
        },
    }
    merged = apply_board_update_patch(candidate, current)
    card = merged["cards"]["card-1"]
    assert card["title"] == "New title"
    assert card["details"] == "New details"
    assert card["priority"] == "high"
    assert card["dueDate"] == "2026-12-31"
    assert card["labels"] == ["release"]
    assert card["assignee"] == "alice"


def test_complex_card_fields_are_always_preserved() -> None:
    """Sub-tasks, comments, attachments, time entries, and linked-card refs
    must survive even if the AI tried to rewrite them — the chat path is
    not allowed to manage these complex collections."""
    current = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["card-1"]}],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "T",
                "details": "",
                "subtasks": [
                    {"id": "s-1", "title": "Step", "done": False}
                ],
                "comments": [
                    {"id": "cm-1", "author": "alice", "body": "Hi"}
                ],
                "attachments": [
                    {"id": "a-1", "label": "Doc", "url": "https://x"}
                ],
                "timeEntries": [
                    {"id": "t-1", "startedAt": "2026-01-01T00:00:00Z"}
                ],
                "linkedCardIds": ["card-2"],
            },
            "card-2": {"id": "card-2", "title": "Other", "details": ""},
        },
    }
    candidate = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["card-1", "card-2"]}],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "T",
                "details": "",
                # AI tries to wipe these:
                "subtasks": [],
                "comments": [],
                "attachments": [],
                "timeEntries": [],
                "linkedCardIds": [],
            }
        },
    }
    merged = apply_board_update_patch(candidate, current)
    card = merged["cards"]["card-1"]
    assert card["subtasks"] == [{"id": "s-1", "title": "Step", "done": False}]
    assert len(card["comments"]) == 1
    assert card["attachments"][0]["url"] == "https://x"
    assert card["linkedCardIds"] == ["card-2"]


def test_ai_can_change_priority_explicitly() -> None:
    current = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["card-1"]}],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "T",
                "details": "",
                "priority": "low",
            }
        },
    }
    candidate = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["card-1"]}],
        "cards": {
            "card-1": {
                "id": "card-1",
                "title": "T",
                "details": "",
                "priority": "urgent",
            }
        },
    }
    merged = apply_board_update_patch(candidate, current)
    assert merged["cards"]["card-1"]["priority"] == "urgent"


def test_new_card_strips_complex_fields_from_ai() -> None:
    """A net-new card the AI invents must not bring in subtasks/comments/etc.
    Those collections need explicit user actions to populate."""
    current = {
        "columns": [{"id": "c", "title": "T", "cardIds": []}],
        "cards": {},
    }
    candidate = {
        "columns": [{"id": "c", "title": "T", "cardIds": ["card-new"]}],
        "cards": {
            "card-new": {
                "id": "card-new",
                "title": "Fresh",
                "details": "",
                "subtasks": [{"id": "s-1", "title": "x", "done": False}],
                "comments": [
                    {"id": "cm-1", "author": "ai", "body": "made it"}
                ],
            }
        },
    }
    merged = apply_board_update_patch(candidate, current)
    new_card = merged["cards"]["card-new"]
    assert new_card["title"] == "Fresh"
    assert "subtasks" not in new_card
    assert "comments" not in new_card


def test_column_wip_limit_survives_ai_omission() -> None:
    current = {
        "columns": [
            {"id": "c", "title": "T", "cardIds": [], "wipLimit": 5}
        ],
        "cards": {},
    }
    candidate = {
        "columns": [{"id": "c", "title": "Renamed", "cardIds": []}],
        "cards": {},
    }
    merged = apply_board_update_patch(candidate, current)
    column = merged["columns"][0]
    assert column["title"] == "Renamed"
    assert column["wipLimit"] == 5


def test_ai_can_override_column_wip_limit_when_explicit() -> None:
    current = {
        "columns": [
            {"id": "c", "title": "T", "cardIds": [], "wipLimit": 5}
        ],
        "cards": {},
    }
    candidate = {
        "columns": [
            {"id": "c", "title": "T", "cardIds": [], "wipLimit": 10}
        ],
        "cards": {},
    }
    merged = apply_board_update_patch(candidate, current)
    assert merged["columns"][0]["wipLimit"] == 10


def test_unmentioned_columns_are_preserved() -> None:
    current = {
        "columns": [
            {"id": "a", "title": "A", "cardIds": []},
            {"id": "b", "title": "B", "cardIds": []},
        ],
        "cards": {},
    }
    candidate = {
        "columns": [{"id": "a", "title": "Renamed A", "cardIds": []}],
        "cards": {},
    }
    merged = apply_board_update_patch(candidate, current)
    titles = [c["title"] for c in merged["columns"]]
    assert titles == ["Renamed A", "B"]
