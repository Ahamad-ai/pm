import { getToken } from "@/lib/auth";
import type { BoardData } from "@/lib/kanban";

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

export type ApiError = Error & {
  status?: number;
  isAuthFailure?: boolean;
};

function buildHeaders(username: string): Record<string, string> {
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
}

async function toError(response: Response, fallback: string): Promise<Error> {
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
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

async function request(
  username: string,
  path: string,
  errorMessage: string,
  options: RequestOptions = {}
): Promise<Response> {
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: buildHeaders(username),
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  if (!response.ok) {
    throw await toError(response, errorMessage);
  }
  return response;
}

async function requestJson<T>(
  username: string,
  path: string,
  errorMessage: string,
  options: RequestOptions = {}
): Promise<T> {
  const response = await request(username, path, errorMessage, options);
  return (await response.json()) as T;
}

export async function fetchBoard(username: string): Promise<BoardData> {
  const payload = await requestJson<BoardResponse>(
    username,
    "/api/board",
    "Board fetch failed"
  );
  return payload.board;
}

export async function saveBoard(
  username: string,
  board: BoardData
): Promise<BoardData> {
  const payload = await requestJson<BoardResponse>(
    username,
    "/api/board",
    "Board save failed",
    { method: "PUT", body: board }
  );
  return payload.board;
}

// ---------------- Multi-board ----------------

export async function listBoards(username: string): Promise<BoardSummary[]> {
  const payload = await requestJson<BoardListResponse>(
    username,
    "/api/boards",
    "Could not list boards"
  );
  return payload.boards;
}

export async function createBoard(
  username: string,
  name: string,
  board?: BoardData
): Promise<BoardDetail> {
  return requestJson<BoardDetail>(username, "/api/boards", "Could not create board", {
    method: "POST",
    body: board ? { name, board } : { name },
  });
}

export async function fetchBoardById(
  username: string,
  boardId: number
): Promise<BoardDetail> {
  return requestJson<BoardDetail>(
    username,
    `/api/boards/${boardId}`,
    "Board fetch failed"
  );
}

export async function updateBoardById(
  username: string,
  boardId: number,
  payload: { name?: string; board?: BoardData }
): Promise<BoardDetail> {
  return requestJson<BoardDetail>(
    username,
    `/api/boards/${boardId}`,
    "Board update failed",
    { method: "PUT", body: payload }
  );
}

export async function deleteBoardById(
  username: string,
  boardId: number
): Promise<void> {
  await request(username, `/api/boards/${boardId}`, "Board delete failed", {
    method: "DELETE",
  });
}

export async function fetchActivity(
  username: string,
  boardId: number
): Promise<ActivityEntry[]> {
  const payload = await requestJson<{ entries: ActivityEntry[] }>(
    username,
    `/api/boards/${boardId}/activity`,
    "Activity fetch failed"
  );
  return payload.entries;
}

// ---------------- Collaborators ----------------

export async function listCollaborators(
  username: string,
  boardId: number
): Promise<Collaborator[]> {
  const payload = await requestJson<{ collaborators: Collaborator[] }>(
    username,
    `/api/boards/${boardId}/collaborators`,
    "Could not list collaborators"
  );
  return payload.collaborators;
}

export async function addCollaborator(
  username: string,
  boardId: number,
  collaboratorUsername: string,
  role: "viewer" | "editor"
): Promise<Collaborator> {
  return requestJson<Collaborator>(
    username,
    `/api/boards/${boardId}/collaborators`,
    "Could not add collaborator",
    { method: "POST", body: { username: collaboratorUsername, role } }
  );
}

export async function removeCollaborator(
  username: string,
  boardId: number,
  collaboratorUsername: string
): Promise<void> {
  await request(
    username,
    `/api/boards/${boardId}/collaborators/${encodeURIComponent(collaboratorUsername)}`,
    "Could not remove collaborator",
    { method: "DELETE" }
  );
}

// ---------------- Stats / export ----------------

export async function fetchBoardStats(
  username: string,
  boardId: number
): Promise<BoardStats> {
  return requestJson<BoardStats>(
    username,
    `/api/boards/${boardId}/stats`,
    "Could not load stats"
  );
}

export function buildExportUrl(boardId: number): string {
  return `/api/boards/${boardId}/export`;
}

export async function pinBoard(
  username: string,
  boardId: number
): Promise<void> {
  await request(username, `/api/boards/${boardId}/pin`, "Could not pin board", {
    method: "POST",
  });
}

export async function unpinBoard(
  username: string,
  boardId: number
): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/pin`, {
    method: "DELETE",
    headers: buildHeaders(username),
  });
  if (!response.ok && response.status !== 404) {
    throw await toError(response, "Could not unpin board");
  }
}

export async function duplicateBoard(
  username: string,
  boardId: number,
  name?: string
): Promise<BoardDetail> {
  return requestJson<BoardDetail>(
    username,
    `/api/boards/${boardId}/duplicate`,
    "Could not duplicate board",
    { method: "POST", body: name ? { name } : {} }
  );
}

export async function importBoard(
  username: string,
  payload: { name?: string; board: BoardData }
): Promise<BoardDetail> {
  return requestJson<BoardDetail>(
    username,
    "/api/boards/import",
    "Could not import board",
    { method: "POST", body: payload }
  );
}

export async function fetchMyTasks(username: string): Promise<UserTask[]> {
  const payload = await requestJson<{ tasks: UserTask[] }>(
    username,
    "/api/users/me/tasks",
    "Could not load tasks"
  );
  return payload.tasks;
}

// ---------------- Search ----------------

export async function searchAll(
  username: string,
  query: string
): Promise<SearchResult> {
  return requestJson<SearchResult>(
    username,
    `/api/search?q=${encodeURIComponent(query)}`,
    "Search failed"
  );
}

// ---------------- Templates ----------------

export async function listTemplates(
  username: string
): Promise<BoardTemplate[]> {
  const payload = await requestJson<{ templates: BoardTemplate[] }>(
    username,
    "/api/templates",
    "Could not load templates"
  );
  return payload.templates;
}

export async function createBoardFromTemplate(
  username: string,
  templateId: string,
  name?: string
): Promise<BoardDetail> {
  return requestJson<BoardDetail>(
    username,
    `/api/boards/from-template/${encodeURIComponent(templateId)}`,
    "Could not create board from template",
    { method: "POST", body: name ? { name } : {} }
  );
}

// ---------------- Notifications ----------------

export async function fetchNotifications(
  username: string,
  onlyUnread: boolean = false
): Promise<{ notifications: Notification[]; unread_count: number }> {
  const url = onlyUnread
    ? "/api/users/me/notifications?only_unread=true"
    : "/api/users/me/notifications";
  return requestJson<{ notifications: Notification[]; unread_count: number }>(
    username,
    url,
    "Could not load notifications"
  );
}

export async function markNotificationRead(
  username: string,
  notificationId: number
): Promise<number> {
  const payload = await requestJson<{ unread_count: number }>(
    username,
    `/api/users/me/notifications/${notificationId}/read`,
    "Could not mark notification as read",
    { method: "POST" }
  );
  return payload.unread_count;
}

export async function markAllNotificationsRead(
  username: string
): Promise<void> {
  await request(
    username,
    "/api/users/me/notifications/read-all",
    "Could not mark notifications as read",
    { method: "POST" }
  );
}

// ---------------- Public share ----------------

export async function getShareLink(
  username: string,
  boardId: number
): Promise<ShareLink> {
  return requestJson<ShareLink>(
    username,
    `/api/boards/${boardId}/share`,
    "Could not load share link"
  );
}

export async function enableShareLink(
  username: string,
  boardId: number
): Promise<ShareLink> {
  return requestJson<ShareLink>(
    username,
    `/api/boards/${boardId}/share`,
    "Could not enable share link",
    { method: "POST" }
  );
}

export async function disableShareLink(
  username: string,
  boardId: number
): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/share`, {
    method: "DELETE",
    headers: buildHeaders(username),
  });
  if (!response.ok && response.status !== 404) {
    throw await toError(response, "Could not disable share link");
  }
}

// ---------------- Chat ----------------

export async function sendChat(
  username: string,
  message: string,
  conversationHistory: ChatHistoryMessage[],
  boardId?: number
): Promise<ChatResponse> {
  return requestJson<ChatResponse>(username, "/api/chat", "Chat request failed", {
    method: "POST",
    body: {
      message,
      conversation_history: conversationHistory,
      board_id: boardId ?? null,
    },
  });
}
