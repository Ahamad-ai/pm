"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { fetchBoard, saveBoard, sendChat, type ChatHistoryMessage } from "@/lib/boardApi";
import { DEMO_USERNAME } from "@/lib/auth";
import { initialData, type BoardData } from "@/lib/kanban";

type BackendKanbanBoardProps = {
  onLogout?: () => void;
};

export const BackendKanbanBoard = ({ onLogout }: BackendKanbanBoardProps = {}) => {
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
    const updatedHistory: ChatHistoryMessage[] = [
      ...chatMessages,
      { role: "user", content: message },
    ];
    setChatMessages(updatedHistory);
    setChatError(null);
    setIsChatting(true);
    try {
      const response = await sendChat(DEMO_USERNAME, message, updatedHistory);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.assistant_message },
      ]);
      if (response.board) {
        setBoard(response.board);
      }
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

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--stroke)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--navy-dark)]">
              <span className="font-display text-base font-semibold text-[var(--accent-yellow)]">
                K
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-base font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </span>
              <span className="hidden text-xs text-[var(--gray-text)] sm:inline">
                / Project board
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition",
                isSaving
                  ? "bg-[var(--accent-yellow)]/10 text-[#a07000]"
                  : "bg-emerald-50 text-emerald-700"
              )}
              aria-live="polite"
            >
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  isSaving
                    ? "animate-pulse bg-[var(--accent-yellow)]"
                    : "bg-emerald-500"
                )}
              />
              {isSaving ? "Saving" : "Saved"}
            </span>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              >
                Log out
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {isLoading || !board ? (
        <main className="flex min-h-screen items-center justify-center px-6 pt-14">
          <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[var(--primary-blue)]" />
            Loading board...
          </div>
        </main>
      ) : (
        <>
          {loadError ? (
            <div className="fixed bottom-5 left-5 z-30 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs font-semibold text-[var(--secondary-purple)] shadow-[var(--shadow)]">
              {loadError}
            </div>
          ) : null}
          {saveError ? (
            <div className="fixed bottom-5 right-5 z-30 rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-xs font-semibold text-[var(--secondary-purple)] shadow-[var(--shadow)]">
              {saveError}
            </div>
          ) : null}
          <div className="pr-[380px] pt-14">
            <KanbanBoard board={board} onBoardChange={handleBoardChange} />
          </div>
          <ChatSidebar
            messages={chatMessages}
            isSending={isChatting}
            error={chatError}
            onSend={handleSendChat}
          />
        </>
      )}
    </>
  );
};
