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
    assert "assistant_message" in schema["schema"]["properties"]
    assert "board_update" in schema["schema"]["properties"]


def test_structured_output_schema_allows_optional_card_fields() -> None:
    """The model needs space for the full card shape — priority/dueDate/etc.
    Without these the AI either fails or wipes existing fields."""
    schema = get_structured_output_schema()
    card_schema = schema["schema"]["properties"]["board_update"]["anyOf"][1][
        "properties"
    ]["cards"]["additionalProperties"]
    properties = card_schema["properties"]
    for field in ("priority", "dueDate", "labels", "assignee", "archived"):
        assert field in properties, f"missing optional field: {field}"


def test_structured_output_schema_allows_column_wip_limit() -> None:
    schema = get_structured_output_schema()
    column_schema = schema["schema"]["properties"]["board_update"]["anyOf"][1][
        "properties"
    ]["columns"]["items"]
    assert "wipLimit" in column_schema["properties"]


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


def test_request_structured_chat_falls_back_when_model_returns_prose() -> None:
    """When the model freelances past the schema and returns plain text,
    the chat path should not 502 — it should surface the prose as the
    assistant message with no board update."""
    import asyncio

    import httpx

    from backend.app.openrouter import request_structured_chat

    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": (
                                "I think you want me to move card-1, but I'm "
                                "not sure I follow."
                            )
                        }
                    }
                ]
            },
        )
    )

    import backend.app.openrouter as openrouter_mod

    async def run() -> dict:
        original_async_client = openrouter_mod.httpx.AsyncClient

        class StubAsyncClient(original_async_client):  # type: ignore[misc]
            def __init__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
                kwargs["transport"] = transport
                super().__init__(*args, **kwargs)

        openrouter_mod.httpx.AsyncClient = StubAsyncClient  # type: ignore[assignment]
        try:
            return await request_structured_chat(
                api_key="test",
                board={"columns": [], "cards": {}},
                user_message="hi",
                conversation_history=[],
            )
        finally:
            openrouter_mod.httpx.AsyncClient = original_async_client  # type: ignore[assignment]

    payload = asyncio.run(run())
    assert payload["board_update"] is None
    assert "move card-1" in payload["assistant_message"]


def test_request_structured_chat_returns_friendly_text_when_model_is_empty() -> None:
    import asyncio

    import httpx

    from backend.app.openrouter import request_structured_chat
    import backend.app.openrouter as openrouter_mod

    transport = httpx.MockTransport(
        lambda request: httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": "   "}}  # whitespace only
                ]
            },
        )
    )

    async def run() -> dict | Exception:
        original_async_client = openrouter_mod.httpx.AsyncClient

        class StubAsyncClient(original_async_client):  # type: ignore[misc]
            def __init__(self, *args, **kwargs):  # type: ignore[no-untyped-def]
                kwargs["transport"] = transport
                super().__init__(*args, **kwargs)

        openrouter_mod.httpx.AsyncClient = StubAsyncClient  # type: ignore[assignment]
        try:
            return await request_structured_chat(
                api_key="test",
                board={"columns": [], "cards": {}},
                user_message="hi",
                conversation_history=[],
            )
        except Exception as exc:
            return exc
        finally:
            openrouter_mod.httpx.AsyncClient = original_async_client  # type: ignore[assignment]

    result = asyncio.run(run())
    # Whitespace-only content still routes through the graceful fallback —
    # we'd rather show a friendly message than 502 the chat session.
    assert isinstance(result, dict)
    assert result["board_update"] is None
    assert "rephrase" in result["assistant_message"].lower()
