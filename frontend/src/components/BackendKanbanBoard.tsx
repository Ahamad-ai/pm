"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ArchivedCardsPanel } from "@/components/ArchivedCardsPanel";
import { BoardStatsStrip } from "@/components/BoardStatsStrip";
import { BoardSwitcher } from "@/components/BoardSwitcher";
import { CalendarView } from "@/components/CalendarView";
import { ChatSidebar } from "@/components/ChatSidebar";
import { CollaboratorsModal } from "@/components/CollaboratorsModal";
import { KanbanBoard } from "@/components/KanbanBoard";
import { MyTasksPanel } from "@/components/MyTasksPanel";
import { NotificationsBell } from "@/components/NotificationsBell";
import { SettingsMenu } from "@/components/SettingsMenu";
import {
  buildExportUrl,
  createBoard,
  createBoardFromTemplate,
  deleteBoardById,
  fetchBoardById,
  listBoards,
  listTemplates,
  pinBoard,
  sendChat,
  unpinBoard,
  updateBoardById,
  type BoardSummary,
  type BoardTemplate,
  type ChatHistoryMessage,
} from "@/lib/boardApi";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  KeyboardShortcutsHelp,
  useKeyboardShortcuts,
} from "@/components/KeyboardShortcuts";
import { getRecentBoardIds, recordRecentBoard } from "@/lib/recentBoards";
import { emptyBoard, type BoardData } from "@/lib/kanban";

const ACTIVE_BOARD_KEY = "pm-active-board-id";

type BackendKanbanBoardProps = {
  username: string;
  displayName?: string;
  onLogout?: () => void;
};

function isAuthFailureError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "isAuthFailure" in err &&
    Boolean((err as { isAuthFailure?: boolean }).isAuthFailure)
  );
}

export function BackendKanbanBoard({
  username,
  displayName,
  onLogout,
}: BackendKanbanBoardProps) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<number | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatHistoryMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [boardView, setBoardView] = useState<"board" | "calendar">("board");
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [recentBoardIds, setRecentBoardIds] = useState<number[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(true);

  useEffect(() => {
    setRecentBoardIds(getRecentBoardIds(username));
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("pm-chat-open");
      if (saved !== null) {
        setIsChatOpen(saved === "true");
        return;
      }
      // Auto-collapse on narrow viewports.
      setIsChatOpen(window.innerWidth >= 1024);
    }
  }, [username]);

  const toggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pm-chat-open", String(next));
      }
      return next;
    });
  };

  useKeyboardShortcuts({
    onShowHelp: () => setShowShortcuts(true),
    onFocusSearch: () => {
      const input = document.getElementById("global-search-input");
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
    },
    onShowBoard: () => setBoardView("board"),
    onShowCalendar: () => setBoardView("calendar"),
    onShowMyTasks: () => setShowMyTasks((value) => !value),
    onShowActivity: () => setShowActivity((value) => !value),
    onShowArchive: () => setShowArchive((value) => !value),
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await listTemplates(username);
        if (!cancelled) {
          setTemplates(list);
        }
      } catch {
        // Templates are non-critical; silent failure is fine.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [username]);
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [statsRefresh, setStatsRefresh] = useState(0);
  const [activeBoardRole, setActiveBoardRole] = useState<
    "owner" | "editor" | "viewer" | null
  >(null);
  const [activeBoardOwner, setActiveBoardOwner] = useState<string | null>(null);
  const [activeBoardName, setActiveBoardName] = useState<string>("");
  const [profileDisplayName, setProfileDisplayName] = useState(displayName ?? username);
  const saveRequestIdRef = useRef(0);

  useEffect(() => {
    if (displayName) {
      setProfileDisplayName(displayName);
    }
  }, [displayName]);

  const persistActiveBoardId = (id: number | null) => {
    if (id === null) {
      localStorage.removeItem(ACTIVE_BOARD_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_BOARD_KEY, String(id));
  };

  const loadBoards = useCallback(
    async (preferredId?: number | null) => {
      setIsLoading(true);
      setLoadError(null);
      try {
        let list = await listBoards(username);
        if (list.length === 0) {
          // First-time user: seed a starter board.
          const created = await createBoard(username, "My Board", emptyBoard);
          list = await listBoards(username);
          setActiveBoardId(created.id);
          setBoard(created.board);
          setBoards(list);
          setActiveBoardRole(created.role ?? "owner");
          setActiveBoardOwner(created.owner ?? username);
          setActiveBoardName(created.name);
          persistActiveBoardId(created.id);
          setRecentBoardIds(recordRecentBoard(username, created.id));
          return;
        }

        const stored = preferredId ?? Number(localStorage.getItem(ACTIVE_BOARD_KEY) || "0");
        const initial = list.find((b) => b.id === stored) ?? list[0];
        setBoards(list);
        setActiveBoardId(initial.id);
        const detail = await fetchBoardById(username, initial.id);
        setBoard(detail.board);
        setActiveBoardRole(detail.role ?? "owner");
        setActiveBoardOwner(detail.owner ?? username);
        setActiveBoardName(detail.name);
        persistActiveBoardId(initial.id);
        setRecentBoardIds(recordRecentBoard(username, initial.id));
      } catch (err) {
        if (isAuthFailureError(err) && onLogout) {
          // Stale session: drop it and bounce back to the login screen.
          onLogout();
          return;
        }
        const message = err instanceof Error ? err.message : "Backend unavailable.";
        setLoadError(message);
        setBoards([]);
        setBoard(null);
        setActiveBoardId(null);
      } finally {
        setIsLoading(false);
      }
    },
    [username, onLogout]
  );

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  const persistBoard = useCallback(
    async (boardId: number, nextBoard: BoardData) => {
      const requestId = saveRequestIdRef.current + 1;
      saveRequestIdRef.current = requestId;
      setIsSaving(true);
      setSaveError(null);
      try {
        await updateBoardById(username, boardId, { board: nextBoard });
        setActivityRefresh((value) => value + 1);
        setStatsRefresh((value) => value + 1);
      } catch (err) {
        if (requestId === saveRequestIdRef.current) {
          const message =
            err instanceof Error && err.message ? err.message : "Could not save.";
          setSaveError(message);
        }
      } finally {
        if (requestId === saveRequestIdRef.current) {
          setIsSaving(false);
        }
      }
    },
    [username]
  );

  const handleBoardChange = (nextBoard: BoardData) => {
    if (activeBoardRole === "viewer") {
      // Viewers can't edit; ignore changes coming from the board UI.
      return;
    }
    setBoard(nextBoard);
    if (activeBoardId !== null) {
      void persistBoard(activeBoardId, nextBoard);
    }
  };

  const handleSelectBoard = async (id: number) => {
    if (id === activeBoardId) {
      return;
    }
    setActiveBoardId(id);
    setBoard(null);
    setIsLoading(true);
    setChatMessages([]);
    setLoadError(null);
    persistActiveBoardId(id);
    setRecentBoardIds(recordRecentBoard(username, id));
    try {
      const detail = await fetchBoardById(username, id);
      setBoard(detail.board);
      setActiveBoardRole(detail.role ?? "owner");
      setActiveBoardOwner(detail.owner ?? username);
      setActiveBoardName(detail.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load board.";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBoard = async (name: string) => {
    const created = await createBoard(username, name, emptyBoard);
    const list = await listBoards(username);
    setBoards(list);
    setActiveBoardId(created.id);
    setBoard(created.board);
    setActiveBoardRole(created.role ?? "owner");
    setActiveBoardOwner(created.owner ?? username);
    setActiveBoardName(created.name);
    persistActiveBoardId(created.id);
    setChatMessages([]);
  };

  const handleCreateFromTemplate = async (
    templateId: string,
    name?: string
  ) => {
    const created = await createBoardFromTemplate(username, templateId, name);
    const list = await listBoards(username);
    setBoards(list);
    setActiveBoardId(created.id);
    setBoard(created.board);
    setActiveBoardRole(created.role ?? "owner");
    setActiveBoardOwner(created.owner ?? username);
    setActiveBoardName(created.name);
    persistActiveBoardId(created.id);
    setChatMessages([]);
  };

  const handleTogglePin = async (id: number, pinned: boolean) => {
    if (pinned) {
      await pinBoard(username, id);
    } else {
      await unpinBoard(username, id);
    }
    const list = await listBoards(username);
    setBoards(list);
  };

  const handleRenameBoard = async (id: number, name: string) => {
    await updateBoardById(username, id, { name });
    const list = await listBoards(username);
    setBoards(list);
  };

  const handleDeleteBoard = async (id: number) => {
    await deleteBoardById(username, id);
    const list = await listBoards(username);
    setBoards(list);
    if (id === activeBoardId) {
      const next = list[0] ?? null;
      if (next) {
        await handleSelectBoard(next.id);
      } else {
        setBoard(null);
        setActiveBoardId(null);
        persistActiveBoardId(null);
      }
    }
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
      const response = await sendChat(
        username,
        message,
        updatedHistory,
        activeBoardId ?? undefined
      );
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.assistant_message },
      ]);
      if (response.board) {
        setBoard(response.board);
        if (response.board_updated) {
          setActivityRefresh((value) => value + 1);
        }
      }
      if (response.board_id && response.board_id !== activeBoardId) {
        setActiveBoardId(response.board_id);
        persistActiveBoardId(response.board_id);
        const list = await listBoards(username);
        setBoards(list);
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not get AI response.";
      setChatError(message);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--stroke)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[1500px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:px-5">
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
                / {displayName ?? username}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BoardSwitcher
              boards={boards}
              activeBoardId={activeBoardId}
              isLoading={isLoading}
              templates={templates}
              recentBoardIds={recentBoardIds}
              onSelect={handleSelectBoard}
              onCreate={handleCreateBoard}
              onCreateFromTemplate={handleCreateFromTemplate}
              onRename={handleRenameBoard}
              onDelete={handleDeleteBoard}
              onTogglePin={handleTogglePin}
            />
            <GlobalSearch
              username={username}
              onJumpToBoard={(id) => {
                if (id !== activeBoardId) {
                  void handleSelectBoard(id);
                }
              }}
            />
            {activeBoardId !== null ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowCollaborators(true)}
                  className="rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                  data-testid="share-button"
                >
                  Share
                </button>
                <a
                  href={buildExportUrl(activeBoardId)}
                  className="rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                  data-testid="export-button"
                >
                  Export
                </a>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setShowMyTasks((value) => !value)}
              className="rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              aria-pressed={showMyTasks}
              data-testid="my-tasks-toggle"
            >
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setShowArchive((value) => !value)}
              className="rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              aria-pressed={showArchive}
              data-testid="archive-toggle"
            >
              Archive
            </button>
            <div
              className="hidden items-center gap-1 rounded-full border border-[var(--stroke)] bg-white px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] sm:inline-flex"
              role="tablist"
              aria-label="Board view"
            >
              <button
                type="button"
                onClick={() => setBoardView("board")}
                role="tab"
                aria-selected={boardView === "board"}
                className={clsx(
                  "rounded-full px-2.5 py-1 transition",
                  boardView === "board"
                    ? "bg-[var(--navy-dark)] text-white"
                    : "hover:text-[var(--navy-dark)]"
                )}
                data-testid="view-board"
              >
                Board
              </button>
              <button
                type="button"
                onClick={() => setBoardView("calendar")}
                role="tab"
                aria-selected={boardView === "calendar"}
                className={clsx(
                  "rounded-full px-2.5 py-1 transition",
                  boardView === "calendar"
                    ? "bg-[var(--navy-dark)] text-white"
                    : "hover:text-[var(--navy-dark)]"
                )}
                data-testid="view-calendar"
              >
                Calendar
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowActivity((value) => !value)}
              className="rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              aria-pressed={showActivity}
              data-testid="activity-toggle"
            >
              Activity
            </button>
            <NotificationsBell
              username={username}
              refreshKey={activityRefresh}
              onJumpToBoard={(id) => {
                if (id !== activeBoardId) {
                  void handleSelectBoard(id);
                }
              }}
            />
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              className="rounded-full border border-[var(--stroke)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              data-testid="shortcuts-toggle"
            >
              ?
            </button>
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
            <SettingsMenu
              username={username}
              displayName={profileDisplayName}
              onProfileUpdated={setProfileDisplayName}
              onLogout={onLogout}
            />
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
          <div
            className={clsx(
              "pt-14 transition-[padding] duration-200",
              isChatOpen ? "lg:pr-[380px]" : ""
            )}
          >
            {activeBoardRole === "viewer" ? (
              <p
                className="mx-6 mt-3 rounded-2xl border border-[var(--accent-yellow)]/40 bg-[var(--accent-yellow)]/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a07000]"
                data-testid="viewer-banner"
              >
                Viewer mode — read-only board
              </p>
            ) : null}
            <div className="px-6 pt-3">
              <BoardStatsStrip
                username={username}
                boardId={activeBoardId}
                refreshKey={statsRefresh}
              />
            </div>
            {boardView === "calendar" ? (
              <div className="px-6 pb-6">
                <CalendarView board={board} />
              </div>
            ) : (
              <KanbanBoard
                board={board}
                canEdit={activeBoardRole !== "viewer"}
                currentUser={username}
                onBoardChange={handleBoardChange}
              />
            )}
          </div>
          <ActivityPanel
            username={username}
            boardId={activeBoardId}
            isOpen={showActivity}
            onClose={() => setShowActivity(false)}
            refreshKey={activityRefresh}
          />
          <MyTasksPanel
            username={username}
            isOpen={showMyTasks}
            onClose={() => setShowMyTasks(false)}
            onJumpToBoard={(boardId) => {
              setShowMyTasks(false);
              if (boardId !== activeBoardId) {
                void handleSelectBoard(boardId);
              }
            }}
            refreshKey={statsRefresh}
          />
          <ArchivedCardsPanel
            board={board}
            isOpen={showArchive}
            canEdit={activeBoardRole !== "viewer"}
            onClose={() => setShowArchive(false)}
            onRestore={(cardId) => {
              const next = {
                ...board,
                cards: {
                  ...board.cards,
                  [cardId]: { ...board.cards[cardId], archived: undefined },
                },
              } as typeof board;
              delete next.cards[cardId].archived;
              handleBoardChange(next);
            }}
            onDelete={(cardId) => {
              if (!window.confirm("Permanently delete this card?")) return;
              const nextCards = { ...board.cards };
              delete nextCards[cardId];
              const nextColumns = board.columns.map((column) => ({
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }));
              handleBoardChange({ columns: nextColumns, cards: nextCards });
            }}
          />
          {showCollaborators && activeBoardId !== null ? (
            <CollaboratorsModal
              username={username}
              boardId={activeBoardId}
              boardName={activeBoardName}
              ownerUsername={activeBoardOwner}
              isOwner={activeBoardRole === "owner"}
              onClose={() => setShowCollaborators(false)}
              onChange={() => setActivityRefresh((value) => value + 1)}
            />
          ) : null}
          <KeyboardShortcutsHelp
            isOpen={showShortcuts}
            onClose={() => setShowShortcuts(false)}
          />
          <ChatSidebar
            messages={chatMessages}
            isSending={isChatting}
            error={chatError}
            isOpen={isChatOpen}
            onToggle={toggleChat}
            onSend={handleSendChat}
          />
        </>
      )}
    </>
  );
}
