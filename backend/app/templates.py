"""Pre-built board templates exposed via /api/templates and used by the
`POST /api/boards/from-template/{template_id}` endpoint."""

from copy import deepcopy
from typing import Any


BOARD_TEMPLATES: dict[str, dict[str, Any]] = {
    "kanban": {
        "id": "kanban",
        "name": "Kanban (default)",
        "description": "Backlog, In Progress, Review, Done — the classic flow.",
        "default_board_name": "Kanban board",
        "board": {
            "columns": [
                {"id": "col-backlog", "title": "Backlog", "cardIds": []},
                {"id": "col-progress", "title": "In Progress", "cardIds": [], "wipLimit": 5},
                {"id": "col-review", "title": "Review", "cardIds": []},
                {"id": "col-done", "title": "Done", "cardIds": []},
            ],
            "cards": {},
        },
    },
    "scrum": {
        "id": "scrum",
        "name": "Scrum sprint",
        "description": "Product backlog → Sprint → In Progress → Review → Done with a WIP limit.",
        "default_board_name": "Scrum sprint",
        "board": {
            "columns": [
                {"id": "col-backlog", "title": "Product Backlog", "cardIds": []},
                {"id": "col-sprint", "title": "Sprint Backlog", "cardIds": []},
                {"id": "col-progress", "title": "In Progress", "cardIds": [], "wipLimit": 3},
                {"id": "col-review", "title": "Review", "cardIds": []},
                {"id": "col-done", "title": "Done", "cardIds": []},
            ],
            "cards": {},
        },
    },
    "personal": {
        "id": "personal",
        "name": "Personal tasks",
        "description": "Today, This week, Later, Done — for individuals.",
        "default_board_name": "My tasks",
        "board": {
            "columns": [
                {"id": "col-today", "title": "Today", "cardIds": []},
                {"id": "col-week", "title": "This week", "cardIds": []},
                {"id": "col-later", "title": "Later", "cardIds": []},
                {"id": "col-done", "title": "Done", "cardIds": []},
            ],
            "cards": {},
        },
    },
    "okr": {
        "id": "okr",
        "name": "OKRs (quarterly)",
        "description": "Objectives and Key Results — track outcomes for the quarter.",
        "default_board_name": "Quarterly OKRs",
        "board": {
            "columns": [
                {"id": "col-objectives", "title": "Objectives", "cardIds": []},
                {"id": "col-key-results", "title": "Key Results", "cardIds": []},
                {"id": "col-progress", "title": "In Progress", "cardIds": []},
                {"id": "col-done", "title": "Achieved", "cardIds": []},
            ],
            "cards": {},
        },
    },
    "bug-tracker": {
        "id": "bug-tracker",
        "name": "Bug tracker",
        "description": "Reported → Triaged → Fixing → Verifying → Released.",
        "default_board_name": "Bugs",
        "board": {
            "columns": [
                {"id": "col-reported", "title": "Reported", "cardIds": []},
                {"id": "col-triaged", "title": "Triaged", "cardIds": []},
                {"id": "col-fixing", "title": "Fixing", "cardIds": [], "wipLimit": 5},
                {"id": "col-verifying", "title": "Verifying", "cardIds": []},
                {"id": "col-released", "title": "Released", "cardIds": []},
            ],
            "cards": {},
        },
    },
}


def list_templates() -> list[dict[str, Any]]:
    return [
        {
            "id": template["id"],
            "name": template["name"],
            "description": template["description"],
            "default_board_name": template["default_board_name"],
            "columns": [
                {
                    "id": column["id"],
                    "title": column["title"],
                    **(
                        {"wipLimit": column["wipLimit"]}
                        if "wipLimit" in column
                        else {}
                    ),
                }
                for column in template["board"]["columns"]
            ],
        }
        for template in BOARD_TEMPLATES.values()
    ]


def get_template_board(template_id: str) -> dict[str, Any] | None:
    template = BOARD_TEMPLATES.get(template_id)
    if template is None:
        return None
    return {
        "name": template["default_board_name"],
        "board": deepcopy(template["board"]),
    }
