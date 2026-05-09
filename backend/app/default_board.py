DEFAULT_BOARD: dict[str, object] = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-3", "card-4"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-5"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-6", "card-7"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-5": {
            "id": "card-5",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-6": {
            "id": "card-6",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}
