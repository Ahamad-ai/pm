_COMPLEX_CARD_FIELDS = (
    "subtasks",
    "comments",
    "attachments",
    "timeEntries",
    "linkedCardIds",
)


def _merge_card(current: dict, candidate: dict) -> dict:
    """Per-field merge: candidate fields win, but anything the AI didn't
    return survives from the current card. Complex nested fields the AI
    isn't trusted to manage (subtasks, comments, attachments, timeEntries,
    linkedCardIds) are always preserved from the current card."""
    if not isinstance(current, dict):
        return dict(candidate)
    merged = {**current, **{k: v for k, v in candidate.items() if v is not None}}
    for field in _COMPLEX_CARD_FIELDS:
        if field in current:
            merged[field] = current[field]
        else:
            merged.pop(field, None)
    return merged


def apply_board_update_patch(
    candidate_board: dict,
    current_board: dict,
) -> dict:
    """Merge an AI-generated board patch into the current board.

    - Cards from the candidate are merged field-by-field with the current
      card so AI omissions don't wipe priority/dueDate/labels/assignee/etc.
    - Sub-tasks, comments, attachments, time entries and linked-card refs
      are *always* preserved from the current card; the AI cannot edit them
      via chat.
    - Card IDs that reference missing card objects are dropped.
    - Unmentioned columns are preserved; mentioned columns get the candidate
      title/cardIds, and `wipLimit` is preserved unless explicitly set.
    """
    current_columns = current_board.get("columns", [])
    current_cards = current_board.get("cards", {})
    candidate_columns = candidate_board.get("columns", [])
    candidate_cards = candidate_board.get("cards", {})

    if not isinstance(current_columns, list) or not isinstance(current_cards, dict):
        return candidate_board
    if not isinstance(candidate_columns, list) or not isinstance(candidate_cards, dict):
        return current_board

    merged_cards: dict = {**current_cards}
    for card_id, candidate_card in candidate_cards.items():
        if not isinstance(candidate_card, dict):
            continue
        existing = merged_cards.get(card_id)
        if isinstance(existing, dict):
            merged_cards[card_id] = _merge_card(existing, candidate_card)
        else:
            # New card — drop any AI-provided complex fields so they don't
            # bypass the validators that normally police them.
            cleaned = {
                k: v
                for k, v in candidate_card.items()
                if k not in _COMPLEX_CARD_FIELDS
            }
            cleaned["id"] = card_id
            merged_cards[card_id] = cleaned
    merged_columns = [dict(column) for column in current_columns if isinstance(column, dict)]
    index_by_id = {
        column.get("id"): idx
        for idx, column in enumerate(merged_columns)
        if isinstance(column.get("id"), str)
    }

    for patch_column in candidate_columns:
        if not isinstance(patch_column, dict):
            continue
        column_id = patch_column.get("id")
        if not isinstance(column_id, str):
            continue
        patch_card_ids = patch_column.get("cardIds")
        normalized_patch_ids = (
            [card_id for card_id in patch_card_ids if isinstance(card_id, str)]
            if isinstance(patch_card_ids, list)
            else None
        )

        if column_id in index_by_id:
            existing = merged_columns[index_by_id[column_id]]
            updated = dict(existing)
            if isinstance(patch_column.get("title"), str):
                updated["title"] = patch_column["title"]
            if normalized_patch_ids is not None:
                updated["cardIds"] = normalized_patch_ids
            patch_wip = patch_column.get("wipLimit")
            if isinstance(patch_wip, int):
                updated["wipLimit"] = patch_wip
            merged_columns[index_by_id[column_id]] = updated
            continue

        merged_columns.append(
            {
                "id": column_id,
                "title": patch_column.get("title", column_id),
                "cardIds": normalized_patch_ids or [],
            }
        )
        index_by_id[column_id] = len(merged_columns) - 1

    # Drop card-ID references that point to no card object.
    sanitized_columns = []
    for column in merged_columns:
        card_ids = column.get("cardIds", [])
        if not isinstance(card_ids, list):
            sanitized_columns.append(column)
            continue
        repaired_ids = [
            card_id
            for card_id in card_ids
            if isinstance(card_id, str) and card_id in merged_cards
        ]
        sanitized_columns.append({**column, "cardIds": repaired_ids})

    return {"columns": sanitized_columns, "cards": merged_cards}
