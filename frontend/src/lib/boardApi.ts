import type { BoardData } from "@/lib/kanban";
import { getToken } from "@/lib/auth";

type BoardResponse = {
  username: string;
  board: BoardData;
};

export type BoardSummary = {
  id: number;
  name: string;
  position: number;
  role?: "owner" | "editor" | "viewer";
  owner?: string | null;
  pinned?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Collaborator = {
  username: string;
  display_name?: string | null;
  role: "viewer" | "editor";
  created_at?: string | null;
};

export type BoardStats = {
  board_id: number;
  total_cards: number;
  total_columns: number;
  by_priority: Record<string, number>;
  by_column: Record<string, number>;
  overdue_count: number;
  with_due_date: number;
  subtasks: { done: number; total: number };
  archived_count?: number;
};

export type Notification = {
  id: number;
  kind: string;
  board_id?: number | null;
  payload?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at?: string | null;
};

export type SearchBoardHit = {
  id: number;
  name: string;
  role?: string | null;
  owner?: string | null;
};

export type SearchCardHit = {
  board_id: number;
  board_name: string;
  column_title?: string | null;
  card_id: string;
  title: string;
  snippet: string;
  priority?: "low" | "medium" | "high" | "urgent" | null;
  assignee?: string | null;
  labels: string[];
};

export type SearchResult = {
  query: string;
  boards: SearchBoardHit[];
  cards: SearchCardHit[];
};

export type BoardTemplateColumn = {
  id: string;
  title: string;
  wipLimit?: number | null;
};

export type BoardTemplate = {
  id: string;
  name: string;
  description: string;
  default_board_name: string;
  columns: BoardTemplateColumn[];
};

export type ShareLink = {
  board_id: number;
  token?: string | null;
  url?: string | null;
};

export type UserTask = {
  board_id: number;
  board_name: string;
  column_title?: string | null;
  card_id: string;
  title: string;
  details: string;
  priority?: "low" | "medium" | "high" | "urgent" | null;
  due_date?: string | null;
  labels: string[];
  overdue: boolean;
  due_in_days?: number | null;
  subtasks: { id: string; title: string; done: boolean }[];
};

export type BoardListResponse = {
  username: string;
  boards: BoardSummary[];
};

export type BoardDetail = BoardSummary & {
  username: string;
  board: BoardData;
  role?: "owner" | "editor" | "viewer";
  owner?: string | null;
};

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  assistant_message: string;
  board_updated: boolean;
  board: BoardData;
  board_id?: number | null;
};

export type ActivityEntry = {
  id: number;
  action: string;
  details: Record<string, unknown> | string | number | null;
  created_at?: string | null;
  username: string;
};

const buildHeaders = (username: string): Record<string, string> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    headers["X-Username"] = username;
  }
  return headers;
};

export type ApiError = Error & {
  status?: number;
  isAuthFailure?: boolean;
};

const toError = async (response: Response, fallback: string): Promise<Error> => {
  let detail = "";
  try {
    const payload = (await response.json()) as { detail?: string };
    detail = payload.detail ?? "";
  } catch {
    detail = "";
  }
  const error: ApiError = new Error(
    `${fallback} (${response.status})${detail ? `: ${detail}` : ""}`
  );
  error.status = response.status;
  if (
    response.status === 401 ||
    (response.status === 400 && detail === "user not found")
  ) {
    error.isAuthFailure = true;
  }
  return error;
};

export const fetchBoard = async (username: string): Promise<BoardData> => {
  const response = await fetch("/api/board", {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Board fetch failed");
  }
  const payload = (await response.json()) as BoardResponse;
  return payload.board;
};

export const saveBoard = async (
  username: string,
  board: BoardData
): Promise<BoardData> => {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: buildHeaders(username),
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw await toError(response, "Board save failed");
  }
  const payload = (await response.json()) as BoardResponse;
  return payload.board;
};

// ---------------- Multi-board ----------------

export const listBoards = async (
  username: string
): Promise<BoardSummary[]> => {
  const response = await fetch("/api/boards", {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not list boards");
  }
  const payload = (await response.json()) as BoardListResponse;
  return payload.boards;
};

export const createBoard = async (
  username: string,
  name: string,
  board?: BoardData
): Promise<BoardDetail> => {
  const response = await fetch("/api/boards", {
    method: "POST",
    headers: buildHeaders(username),
    body: JSON.stringify(board ? { name, board } : { name }),
  });
  if (!response.ok) {
    throw await toError(response, "Could not create board");
  }
  return (await response.json()) as BoardDetail;
};

export const fetchBoardById = async (
  username: string,
  boardId: number
): Promise<BoardDetail> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Board fetch failed");
  }
  return (await response.json()) as BoardDetail;
};

export const updateBoardById = async (
  username: string,
  boardId: number,
  payload: { name?: string; board?: BoardData }
): Promise<BoardDetail> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: buildHeaders(username),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await toError(response, "Board update failed");
  }
  return (await response.json()) as BoardDetail;
};

export const deleteBoardById = async (
  username: string,
  boardId: number
): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "DELETE",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Board delete failed");
  }
};

export const fetchActivity = async (
  username: string,
  boardId: number
): Promise<ActivityEntry[]> => {
  const response = await fetch(`/api/boards/${boardId}/activity`, {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Activity fetch failed");
  }
  const payload = (await response.json()) as { entries: ActivityEntry[] };
  return payload.entries;
};

// ---------------- Collaborators ----------------

export const listCollaborators = async (
  username: string,
  boardId: number
): Promise<Collaborator[]> => {
  const response = await fetch(`/api/boards/${boardId}/collaborators`, {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not list collaborators");
  }
  const payload = (await response.json()) as { collaborators: Collaborator[] };
  return payload.collaborators;
};

export const addCollaborator = async (
  username: string,
  boardId: number,
  collaboratorUsername: string,
  role: "viewer" | "editor"
): Promise<Collaborator> => {
  const response = await fetch(`/api/boards/${boardId}/collaborators`, {
    method: "POST",
    headers: buildHeaders(username),
    body: JSON.stringify({ username: collaboratorUsername, role }),
  });
  if (!response.ok) {
    throw await toError(response, "Could not add collaborator");
  }
  return (await response.json()) as Collaborator;
};

export const removeCollaborator = async (
  username: string,
  boardId: number,
  collaboratorUsername: string
): Promise<void> => {
  const response = await fetch(
    `/api/boards/${boardId}/collaborators/${encodeURIComponent(collaboratorUsername)}`,
    {
      method: "DELETE",
      headers: buildHeaders(username),
    }
  );
  if (!response.ok) {
    throw await toError(response, "Could not remove collaborator");
  }
};

// ---------------- Stats / export ----------------

export const fetchBoardStats = async (
  username: string,
  boardId: number
): Promise<BoardStats> => {
  const response = await fetch(`/api/boards/${boardId}/stats`, {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not load stats");
  }
  return (await response.json()) as BoardStats;
};

export const buildExportUrl = (boardId: number): string =>
  `/api/boards/${boardId}/export`;

export const pinBoard = async (
  username: string,
  boardId: number
): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}/pin`, {
    method: "POST",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not pin board");
  }
};

export const unpinBoard = async (
  username: string,
  boardId: number
): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}/pin`, {
    method: "DELETE",
    headers: buildHeaders(username),
  });
  if (!response.ok && response.status !== 404) {
    throw await toError(response, "Could not unpin board");
  }
};

export const duplicateBoard = async (
  username: string,
  boardId: number,
  name?: string
): Promise<BoardDetail> => {
  const response = await fetch(`/api/boards/${boardId}/duplicate`, {
    method: "POST",
    headers: buildHeaders(username),
    body: JSON.stringify(name ? { name } : {}),
  });
  if (!response.ok) {
    throw await toError(response, "Could not duplicate board");
  }
  return (await response.json()) as BoardDetail;
};

export const importBoard = async (
  username: string,
  payload: { name?: string; board: BoardData }
): Promise<BoardDetail> => {
  const response = await fetch("/api/boards/import", {
    method: "POST",
    headers: buildHeaders(username),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw await toError(response, "Could not import board");
  }
  return (await response.json()) as BoardDetail;
};

export const fetchMyTasks = async (
  username: string
): Promise<UserTask[]> => {
  const response = await fetch("/api/users/me/tasks", {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not load tasks");
  }
  const payload = (await response.json()) as { tasks: UserTask[] };
  return payload.tasks;
};

// ---------------- Search ----------------

export const searchAll = async (
  username: string,
  query: string
): Promise<SearchResult> => {
  const response = await fetch(
    `/api/search?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: buildHeaders(username),
    }
  );
  if (!response.ok) {
    throw await toError(response, "Search failed");
  }
  return (await response.json()) as SearchResult;
};

// ---------------- Templates ----------------

export const listTemplates = async (
  username: string
): Promise<BoardTemplate[]> => {
  const response = await fetch("/api/templates", {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not load templates");
  }
  const payload = (await response.json()) as { templates: BoardTemplate[] };
  return payload.templates;
};

export const createBoardFromTemplate = async (
  username: string,
  templateId: string,
  name?: string
): Promise<BoardDetail> => {
  const response = await fetch(
    `/api/boards/from-template/${encodeURIComponent(templateId)}`,
    {
      method: "POST",
      headers: buildHeaders(username),
      body: JSON.stringify(name ? { name } : {}),
    }
  );
  if (!response.ok) {
    throw await toError(response, "Could not create board from template");
  }
  return (await response.json()) as BoardDetail;
};

// ---------------- Notifications ----------------

export const fetchNotifications = async (
  username: string,
  onlyUnread: boolean = false
): Promise<{ notifications: Notification[]; unread_count: number }> => {
  const url = onlyUnread
    ? "/api/users/me/notifications?only_unread=true"
    : "/api/users/me/notifications";
  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not load notifications");
  }
  const payload = (await response.json()) as {
    notifications: Notification[];
    unread_count: number;
  };
  return payload;
};

export const markNotificationRead = async (
  username: string,
  notificationId: number
): Promise<number> => {
  const response = await fetch(
    `/api/users/me/notifications/${notificationId}/read`,
    {
      method: "POST",
      headers: buildHeaders(username),
    }
  );
  if (!response.ok) {
    throw await toError(response, "Could not mark notification as read");
  }
  const payload = (await response.json()) as { unread_count: number };
  return payload.unread_count;
};

export const markAllNotificationsRead = async (
  username: string
): Promise<void> => {
  const response = await fetch("/api/users/me/notifications/read-all", {
    method: "POST",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not mark notifications as read");
  }
};

// ---------------- Public share ----------------

export const getShareLink = async (
  username: string,
  boardId: number
): Promise<ShareLink> => {
  const response = await fetch(`/api/boards/${boardId}/share`, {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not load share link");
  }
  return (await response.json()) as ShareLink;
};

export const enableShareLink = async (
  username: string,
  boardId: number
): Promise<ShareLink> => {
  const response = await fetch(`/api/boards/${boardId}/share`, {
    method: "POST",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw await toError(response, "Could not enable share link");
  }
  return (await response.json()) as ShareLink;
};

export const disableShareLink = async (
  username: string,
  boardId: number
): Promise<void> => {
  const response = await fetch(`/api/boards/${boardId}/share`, {
    method: "DELETE",
    headers: buildHeaders(username),
  });
  if (!response.ok && response.status !== 404) {
    throw await toError(response, "Could not disable share link");
  }
};

// ---------------- Chat ----------------

export const sendChat = async (
  username: string,
  message: string,
  conversationHistory: ChatHistoryMessage[],
  boardId?: number
): Promise<ChatResponse> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: buildHeaders(username),
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
      board_id: boardId ?? null,
    }),
  });
  if (!response.ok) {
    throw await toError(response, "Chat request failed");
  }
  return (await response.json()) as ChatResponse;
};
