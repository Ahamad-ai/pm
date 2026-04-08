import type { BoardData } from "@/lib/kanban";

type BoardResponse = {
  username: string;
  board: BoardData;
};

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  assistant_message: string;
  board_updated: boolean;
  board: BoardData;
};

const buildHeaders = (username: string) => ({
  "Content-Type": "application/json",
  "X-Username": username,
});

export const fetchBoard = async (username: string): Promise<BoardData> => {
  const response = await fetch("/api/board", {
    method: "GET",
    headers: buildHeaders(username),
  });
  if (!response.ok) {
    throw new Error(`Board fetch failed with ${response.status}`);
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
    throw new Error(`Board save failed with ${response.status}`);
  }
  const payload = (await response.json()) as BoardResponse;
  return payload.board;
};

export const sendChat = async (
  username: string,
  message: string,
  conversationHistory: ChatHistoryMessage[]
): Promise<ChatResponse> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: buildHeaders(username),
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ? `: ${payload.detail}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`Chat request failed with ${response.status}${detail}`);
  }
  return (await response.json()) as ChatResponse;
};
