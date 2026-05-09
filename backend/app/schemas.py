from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ---------------- Cards / Columns / Boards ----------------


class SubTaskModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    done: bool = False


class CommentModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    author: str
    body: str
    createdAt: str | None = None


class AttachmentModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    label: str
    url: str


class TimeEntryModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    startedAt: str
    endedAt: str | None = None
    seconds: int | None = None


class CardModel(BaseModel):
    """A card on the board.

    Most fields beyond id/title are optional. We keep `extra="ignore"` so
    AI responses with unexpected keys don't break parsing.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    details: str = ""
    priority: Literal["low", "medium", "high", "urgent"] | None = None
    dueDate: str | None = None
    labels: list[str] | None = None
    assignee: str | None = None
    createdAt: str | None = None
    subtasks: list[SubTaskModel] | None = None
    comments: list[CommentModel] | None = None
    archived: bool | None = None
    linkedCardIds: list[str] | None = None
    attachments: list[AttachmentModel] | None = None
    timeEntries: list[TimeEntryModel] | None = None


class ColumnModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    title: str
    cardIds: list[str]
    wipLimit: int | None = None


class SavedViewFilter(BaseModel):
    model_config = ConfigDict(extra="ignore")

    query: str | None = None
    priorities: list[Literal["low", "medium", "high", "urgent"]] | None = None
    labels: list[str] | None = None
    assignees: list[str] | None = None
    overdueOnly: bool | None = None


class SavedView(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    filter: SavedViewFilter


class BoardModel(BaseModel):
    model_config = ConfigDict(extra="ignore")

    columns: list[ColumnModel]
    cards: dict[str, CardModel]
    views: list[SavedView] | None = None


class BoardResponse(BaseModel):
    """Response for the legacy single-board endpoint (back-compat)."""

    username: str
    board: BoardModel


# ---------------- Multi-board ----------------


class BoardSummary(BaseModel):
    id: int
    name: str
    position: int
    role: str = "owner"
    owner: str | None = None
    pinned: bool = False
    created_at: str | None = None
    updated_at: str | None = None


class BoardListResponse(BaseModel):
    username: str
    boards: list[BoardSummary]


class BoardCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    board: BoardModel | None = None


class BoardDuplicateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80)


class BoardImportRequest(BaseModel):
    """Accepts the same shape that GET /api/boards/{id}/export emits."""

    name: str | None = Field(default=None, max_length=80)
    board: BoardModel


class BoardUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80)
    board: BoardModel | None = None


class BoardDetailResponse(BaseModel):
    username: str
    id: int
    name: str
    position: int
    board: BoardModel
    role: str = "owner"
    owner: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CollaboratorEntry(BaseModel):
    username: str
    display_name: str | None = None
    role: str
    created_at: str | None = None


class CollaboratorListResponse(BaseModel):
    board_id: int
    collaborators: list[CollaboratorEntry]


class CollaboratorAddRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    role: Literal["viewer", "editor"] = "editor"


class BoardStatsResponse(BaseModel):
    board_id: int
    total_cards: int
    total_columns: int
    by_priority: dict[str, int]
    by_column: dict[str, int]
    overdue_count: int
    with_due_date: int
    subtasks: dict[str, int]
    archived_count: int = 0


# ---------------- Activity log ----------------


class ActivityEntry(BaseModel):
    id: int
    action: str
    details: dict | list | str | int | None = None
    created_at: str | None = None
    username: str


class ActivityResponse(BaseModel):
    board_id: int
    entries: list[ActivityEntry]


# ---------------- Auth ----------------


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=6, max_length=256)
    display_name: str | None = Field(default=None, max_length=80)


class AuthResponse(BaseModel):
    token: str
    username: str
    display_name: str | None = None
    role: str = "member"


class ProfileResponse(BaseModel):
    username: str
    display_name: str | None = None
    role: str = "member"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=256)


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)


class NotificationEntry(BaseModel):
    id: int
    kind: str
    board_id: int | None = None
    payload: dict | list | str | int | None = None
    read_at: str | None = None
    created_at: str | None = None


class NotificationListResponse(BaseModel):
    username: str
    unread_count: int
    notifications: list[NotificationEntry]


class ShareLinkResponse(BaseModel):
    board_id: int
    token: str | None = None
    url: str | None = None


class PublicBoardResponse(BaseModel):
    id: int
    name: str
    owner: str | None = None
    updated_at: str | None = None
    board: BoardModel


class SearchBoardHit(BaseModel):
    id: int
    name: str
    role: str | None = None
    owner: str | None = None


class SearchCardHit(BaseModel):
    board_id: int
    board_name: str
    column_title: str | None = None
    card_id: str
    title: str
    snippet: str = ""
    priority: Literal["low", "medium", "high", "urgent"] | None = None
    assignee: str | None = None
    labels: list[str] = []


class SearchResponse(BaseModel):
    query: str
    boards: list[SearchBoardHit]
    cards: list[SearchCardHit]


class TemplateColumnSummary(BaseModel):
    id: str
    title: str
    wipLimit: int | None = None


class TemplateEntry(BaseModel):
    id: str
    name: str
    description: str
    default_board_name: str
    columns: list[TemplateColumnSummary]


class TemplateListResponse(BaseModel):
    templates: list[TemplateEntry]


class TemplateInstantiateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=80)


class UserTaskEntry(BaseModel):
    board_id: int
    board_name: str
    column_title: str | None = None
    card_id: str
    title: str
    details: str = ""
    priority: Literal["low", "medium", "high", "urgent"] | None = None
    due_date: str | None = None
    labels: list[str] = []
    overdue: bool = False
    due_in_days: int | None = None
    subtasks: list[SubTaskModel] = []


class UserTasksResponse(BaseModel):
    username: str
    tasks: list[UserTaskEntry]


# ---------------- Chat ----------------


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_history: list[ChatMessage] = Field(default_factory=list)
    board_id: int | None = None


class StructuredAIResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    assistant_message: str
    board_update: BoardModel | None = None


class ChatResponse(BaseModel):
    assistant_message: str
    board_updated: bool
    board: BoardModel
    board_id: int | None = None
