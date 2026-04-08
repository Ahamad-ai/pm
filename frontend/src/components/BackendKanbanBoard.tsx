"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { fetchBoard, saveBoard, sendChat, type ChatHistoryMessage } from "@/lib/boardApi";
import { DEMO_USERNAME } from "@/lib/auth";
import { initialData, type BoardData } from "@/lib/kanban";

export const BackendKanbanBoard = () => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatHistoryMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveRequestIdRef = useRef(0);

  const loadBoard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const nextBoard = await fetchBoard(DEMO_USERNAME);
      setBoard(nextBoard);
    } catch {
      // Allow local dev/test runs without backend while keeping backend-first behavior.
      setBoard(initialData);
      setLoadError("Backend unavailable. Running in local-only mode.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const persistBoard = useCallback(async (nextBoard: BoardData) => {
    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveBoard(DEMO_USERNAME, nextBoard);
    } catch {
      if (requestId === saveRequestIdRef.current) {
        setSaveError("Could not save board changes.");
      }
    } finally {
      if (requestId === saveRequestIdRef.current) {
        setIsSaving(false);
      }
    }
  }, []);

  const handleBoardChange = (nextBoard: BoardData) => {
    setBoard(nextBoard);
    void persistBoard(nextBoard);
  };

  const handleSendChat = async (message: string) => {
    const conversationHistory = [...chatMessages];
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setChatError(null);
    setIsChatting(true);
    try {
      const response = await sendChat(DEMO_USERNAME, message, conversationHistory);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.assistant_message },
      ]);
      setBoard(response.board);
    } catch (error) {
      if (error instanceof Error && error.message) {
        setChatError(error.message);
      } else {
        setChatError("Could not get AI response.");
      }
    } finally {
      setIsChatting(false);
    }
  };

  if (isLoading || !board) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Loading board...
        </p>
      </main>
    );
  }

  return (
    <>
      <div className="fixed left-5 top-5 z-20 rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] shadow-[var(--shadow)]">
        {isSaving ? "Saving..." : "Saved"}
      </div>
      {loadError ? (
        <div className="fixed bottom-5 left-5 z-20 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs font-semibold text-[var(--secondary-purple)] shadow-[var(--shadow)]">
          {loadError}
        </div>
      ) : null}
      {saveError ? (
        <div className="fixed bottom-5 right-5 z-20 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs font-semibold text-[var(--secondary-purple)] shadow-[var(--shadow)]">
          {saveError}
        </div>
      ) : null}
      <div className="pr-[380px]">
        <KanbanBoard board={board} onBoardChange={handleBoardChange} />
      </div>
      <ChatSidebar
        messages={chatMessages}
        isSending={isChatting}
        error={chatError}
        onSend={handleSendChat}
      />
    </>
  );
};
