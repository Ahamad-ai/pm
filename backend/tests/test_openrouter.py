from backend.app.openrouter import (
    build_structured_messages,
    get_structured_output_schema,
    parse_structured_content,
)


def test_build_structured_messages_includes_board_and_history() -> None:
    board = {
        "columns": [{"id": "col-a", "title": "Backlog", "cardIds": ["card-1"]}],
        "cards": {"card-1": {"id": "card-1", "title": "Task", "details": "Details"}},
    }
    history = [
        {"role": "user", "content": "Can you help?"},
        {"role": "assistant", "content": "Sure."},
    ]
    messages = build_structured_messages(
        board=board,
        user_message="Move this card to done",
        conversation_history=history,
    )

    assert messages[0]["role"] == "system"
    assert messages[1] == history[0]
    assert messages[2] == history[1]
    assert messages[-1]["role"] == "user"
    assert '"columns":[{"id":"col-a","title":"Backlog","cardIds":["card-1"]}]' in messages[-1][
        "content"
    ]
    assert "Move this card to done" in messages[-1]["content"]


def test_structured_output_schema_has_expected_shape() -> None:
    schema = get_structured_output_schema()
    assert schema["name"] == "kanban_chat_response"
    assert schema["strict"] is True
    assert "assistant_message" in schema["schema"]["properties"]
    assert "board_update" in schema["schema"]["properties"]


def test_parse_structured_content_handles_markdown_wrapped_json() -> None:
    content = """```json
{
  "assistant_message": "Done",
  "board_update": null
}
```"""
    parsed = parse_structured_content(content)
    assert parsed["assistant_message"] == "Done"
    assert parsed["board_update"] is None


def test_parse_structured_content_handles_segmented_message_content() -> None:
    content = [
        {"type": "output_text", "text": '{"assistant_message":"Hi","board_update":null}'}
    ]
    parsed = parse_structured_content(content)
    assert parsed["assistant_message"] == "Hi"
