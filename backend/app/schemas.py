from typing import Literal

from pydantic import BaseModel, Field


class CardModel(BaseModel):
    id: str
    title: str
    details: str


class ColumnModel(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardModel(BaseModel):
    columns: list[ColumnModel]
    cards: dict[str, CardModel]


class BoardResponse(BaseModel):
    username: str
    board: BoardModel


class ChatRequest(BaseModel):
    message: str
    conversation_history: list["ChatMessage"] = Field(default_factory=list)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class StructuredAIResponse(BaseModel):
    assistant_message: str
    board_update: BoardModel | None = None


class ChatResponse(BaseModel):
    assistant_message: str
    board_updated: bool
    board: BoardModel
