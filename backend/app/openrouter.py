import json
import os
from typing import Any
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import HTTPException

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODEL = "openai/gpt-oss-120b:free"
DEFAULT_TIMEOUT_SECONDS = 45.0

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def get_openrouter_api_key() -> str:
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTER_API_KEY is not configured.",
        )
    return key


def normalize_message(user_message: str) -> str:
    message = user_message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    return message


def get_structured_output_schema() -> dict[str, Any]:
    """JSON-schema for OpenRouter's structured-output mode.

    Schema mirrors the full card/column shape so the model can faithfully
    echo input fields. We avoid `strict: True` here — the free-tier model
    doesn't reliably honor strict schemas when the input has many fields,
    and the backend re-validates the response with Pydantic + sanitizes
    via `_validate_board_data` anyway.
    """
    return {
        "name": "kanban_chat_response",
        "schema": {
            "type": "object",
            "properties": {
                "assistant_message": {"type": "string"},
                "board_update": {
                    "anyOf": [
                        {"type": "null"},
                        {
                            "type": "object",
                            "properties": {
                                "columns": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "string"},
                                            "title": {"type": "string"},
                                            "cardIds": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                            "wipLimit": {"type": ["integer", "null"]},
                                        },
                                        "required": ["id", "title", "cardIds"],
                                    },
                                },
                                "cards": {
                                    "type": "object",
                                    "additionalProperties": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "string"},
                                            "title": {"type": "string"},
                                            "details": {"type": "string"},
                                            "priority": {
                                                "type": ["string", "null"],
                                                "enum": [
                                                    "low",
                                                    "medium",
                                                    "high",
                                                    "urgent",
                                                    None,
                                                ],
                                            },
                                            "dueDate": {"type": ["string", "null"]},
                                            "labels": {
                                                "type": ["array", "null"],
                                                "items": {"type": "string"},
                                            },
                                            "assignee": {"type": ["string", "null"]},
                                            "archived": {"type": ["boolean", "null"]},
                                        },
                                        "required": ["id", "title", "details"],
                                    },
                                },
                            },
                            "required": ["columns", "cards"],
                        },
                    ]
                },
            },
            "required": ["assistant_message", "board_update"],
        },
    }


def _extract_content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            item["text"]
            for item in content
            if isinstance(item, dict) and isinstance(item.get("text"), str)
        )
    return ""


def _extract_first_json_object(raw_text: str) -> str | None:
    text = raw_text.strip()
    if not text:
        return None

    if text.startswith("```"):
        lines = text.splitlines()
        if len(lines) >= 3 and lines[-1].strip() == "```":
            candidate = "\n".join(lines[1:-1]).strip()
            if candidate.lower().startswith("json"):
                candidate = candidate[4:].strip()
            if candidate:
                text = candidate

    depth = 0
    start_idx = -1
    for idx, char in enumerate(text):
        if char == "{":
            if depth == 0:
                start_idx = idx
            depth += 1
        elif char == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start_idx != -1:
                    return text[start_idx : idx + 1]
    return text if text.startswith("{") and text.endswith("}") else None


def parse_structured_content(content: Any) -> dict[str, Any]:
    text = _extract_content_text(content)
    candidate = _extract_first_json_object(text)
    if not candidate:
        raise ValueError("No JSON object found in model content.")
    parsed = json.loads(candidate)
    if not isinstance(parsed, dict):
        raise ValueError("Structured output is not a JSON object.")
    return parsed


def build_structured_messages(
    *,
    board: dict[str, Any],
    user_message: str,
    conversation_history: list[dict[str, str]],
) -> list[dict[str, str]]:
    serialized_board = json.dumps(board, separators=(",", ":"))
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": (
                "You are a helpful project management assistant. "
                "Reply only with valid JSON matching the required schema. "
                "If no board change is needed, set board_update to null. "
                "When you DO modify the board, preserve every existing card "
                "field (priority, dueDate, labels, assignee, archived, etc.) "
                "unless the user asked to change it. Only include cards in "
                "`cards` that you are creating or modifying — unchanged cards "
                "may be omitted. The board may have fields you don't recognise "
                "(subtasks, comments, attachments, timeEntries, linkedCardIds). "
                "Never echo those back; the server preserves them automatically."
            ),
        }
    ]
    for message in conversation_history:
        role = message.get("role")
        content = message.get("content")
        if role in {"user", "assistant"} and isinstance(content, str):
            messages.append({"role": role, "content": content})

    messages.append(
        {
            "role": "user",
            "content": (
                "Current kanban board JSON:\n"
                f"{serialized_board}\n\n"
                f"User question:\n{normalize_message(user_message)}"
            ),
        }
    )
    return messages


async def request_structured_chat(
    *,
    api_key: str,
    board: dict[str, Any],
    user_message: str,
    conversation_history: list[dict[str, str]],
) -> dict[str, Any]:
    payload = {
        "model": OPENROUTER_MODEL,
        "stream": False,
        "messages": build_structured_messages(
            board=board,
            user_message=user_message,
            conversation_history=conversation_history,
        ),
        "response_format": {
            "type": "json_schema",
            "json_schema": get_structured_output_schema(),
        },
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(DEFAULT_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"OpenRouter error {response.status_code}: {response.text}",
                )
            response_payload = response.json()
            content = (
                response_payload.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if not content:
                raise HTTPException(
                    status_code=502,
                    detail="OpenRouter response did not include JSON content.",
                )
            try:
                return parse_structured_content(content)
            except (json.JSONDecodeError, ValueError):
                # The model produced text that didn't parse as JSON — usually
                # because the free-tier model freelanced past the schema.
                # Return its prose as `assistant_message` with no board update
                # rather than failing the whole chat turn.
                fallback_text = _extract_content_text(content).strip()
                if not fallback_text:
                    fallback_text = (
                        "I had trouble formatting that as a board update. "
                        "Could you rephrase the request?"
                    )
                return {
                    "assistant_message": fallback_text,
                    "board_update": None,
                }
        except httpx.TimeoutException as exc:
            raise HTTPException(status_code=504, detail="OpenRouter request timed out.") from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="OpenRouter request failed.") from exc
