def apply_board_update_patch(
    candidate_board: dict,
    current_board: dict,
) -> dict:
    """Merge an AI-generated board patch into the current board.

    Columns and cards from the candidate are layered on top of the current
    board.  Card IDs that reference missing card objects are dropped;
    unmentioned columns are preserved.
    """
    current_columns = current_board.get("columns", [])
    current_cards = current_board.get("cards", {})
    candidate_columns = candidate_board.get("columns", [])
    candidate_cards = candidate_board.get("cards", {})

    if not isinstance(current_columns, list) or not isinstance(current_cards, dict):
        return candidate_board
    if not isinstance(candidate_columns, list) or not isinstance(candidate_cards, dict):
        return current_board

    merged_cards = {**current_cards, **candidate_cards}
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
        repaired_ids = []
        for card_id in card_ids:
            if not isinstance(card_id, str):
                continue
            if card_id in merged_cards:
                repaired_ids.append(card_id)
        sanitized_columns.append({**column, "cardIds": repaired_ids})

    return {"columns": sanitized_columns, "cards": merged_cards}
