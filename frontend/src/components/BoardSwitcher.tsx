"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BoardSummary, BoardTemplate } from "@/lib/boardApi";

type BoardSwitcherProps = {
  boards: BoardSummary[];
  activeBoardId: number | null;
  isLoading?: boolean;
  templates?: BoardTemplate[];
  recentBoardIds?: number[];
  onSelect: (boardId: number) => void;
  onCreate: (name: string) => Promise<void> | void;
  onCreateFromTemplate?: (
    templateId: string,
    name?: string
  ) => Promise<void> | void;
  onRename: (boardId: number, name: string) => Promise<void> | void;
  onDelete: (boardId: number) => Promise<void> | void;
  onTogglePin?: (boardId: number, pinned: boolean) => Promise<void> | void;
};

export function BoardSwitcher({
  boards,
  activeBoardId,
  isLoading,
  templates,
  recentBoardIds,
  onSelect,
  onCreate,
  onCreateFromTemplate,
  onRename,
  onDelete,
  onTogglePin,
}: BoardSwitcherProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeBoard = boards.find((b) => b.id === activeBoardId) ?? null;

  let triggerLabel: string;
  if (activeBoard) {
    triggerLabel = activeBoard.name;
  } else if (isLoading) {
    triggerLabel = "Loading...";
  } else {
    triggerLabel = "No board";
  }

  useEffect(() => {
    if (!showMenu) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowMenu(false);
        setEditingBoardId(null);
        setShowCreate(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = draftName.trim();
    if (!cleaned) {
      return;
    }
    setBusy(true);
    try {
      if (selectedTemplate && onCreateFromTemplate) {
        await onCreateFromTemplate(selectedTemplate, cleaned);
      } else {
        await onCreate(cleaned);
      }
      setShowCreate(false);
      setDraftName("");
      setSelectedTemplate("");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>, id: number) => {
    event.preventDefault();
    const cleaned = draftName.trim();
    if (!cleaned) {
      return;
    }
    setBusy(true);
    try {
      await onRename(id, cleaned);
      setEditingBoardId(null);
      setDraftName("");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (boards.length <= 1) {
      return;
    }
    if (!window.confirm(`Delete board "${name}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    try {
      await onDelete(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setShowMenu((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--navy-dark)] shadow-sm transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
        aria-haspopup="menu"
        aria-expanded={showMenu}
        data-testid="board-switcher-trigger"
      >
        <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
        <span className="max-w-[180px] truncate">{triggerLabel}</span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M5 7l5 5 5-5z" />
        </svg>
      </button>
      {showMenu ? (
        <div
          className="absolute left-0 z-50 mt-2 w-72 max-w-[calc(100vw-1.5rem)] origin-top-left rounded-2xl border border-[var(--stroke)] bg-white p-2 shadow-[var(--shadow)]"
          role="menu"
          data-testid="board-switcher-menu"
        >
          {recentBoardIds && recentBoardIds.length > 1 ? (
            <>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Recent
              </p>
              <ul
                className="mb-2 space-y-0.5"
                data-testid="board-switcher-recents"
              >
                {recentBoardIds
                  .map((id) => boards.find((b) => b.id === id))
                  .filter((b): b is BoardSummary => Boolean(b))
                  .slice(0, 5)
                  .map((board) => {
                    const isActive = board.id === activeBoardId;
                    return (
                      <li key={`recent-${board.id}`}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(board.id);
                            setShowMenu(false);
                          }}
                          className={clsx(
                            "block w-full truncate rounded-lg px-2 py-1 text-left text-xs",
                            isActive
                              ? "bg-[var(--surface-muted)] text-[var(--navy-dark)]"
                              : "text-[var(--navy-dark)] hover:bg-[var(--surface-muted)]"
                          )}
                          data-testid={`recent-board-${board.id}`}
                        >
                          {board.pinned ? "★ " : ""}
                          {board.name}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </>
          ) : null}
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Your boards
          </p>
          <ul className="max-h-64 overflow-y-auto py-1">
            {[...boards]
              .sort((a, b) => {
                if ((a.pinned ?? false) !== (b.pinned ?? false)) {
                  return a.pinned ? -1 : 1;
                }
                return a.position - b.position;
              })
              .map((board) => {
              const isActive = board.id === activeBoardId;
              const isEditing = editingBoardId === board.id;
              return (
                <li key={board.id}>
                  {isEditing ? (
                    <form
                      onSubmit={(event) => handleRename(event, board.id)}
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        className="flex-1 rounded-lg border border-[var(--stroke)] px-2 py-1 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                        aria-label="Rename board"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-md bg-[var(--secondary-purple)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBoardId(null);
                          setDraftName("");
                        }}
                        className="rounded-md border border-[var(--stroke)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div
                      className={clsx(
                        "flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition",
                        isActive
                          ? "bg-[var(--surface-muted)] text-[var(--navy-dark)]"
                          : "text-[var(--navy-dark)] hover:bg-[var(--surface-muted)]"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(board.id);
                          setShowMenu(false);
                        }}
                        className="flex-1 truncate text-left"
                        data-testid={`board-option-${board.id}`}
                      >
                        {isActive ? "✓ " : ""}
                        {board.pinned ? "★ " : ""}
                        {board.name}
                      </button>
                      {onTogglePin ? (
                        <button
                          type="button"
                          onClick={() =>
                            onTogglePin(board.id, !(board.pinned ?? false))
                          }
                          className={clsx(
                            "rounded-md p-1 text-xs transition hover:bg-white",
                            board.pinned
                              ? "text-[var(--accent-yellow)]"
                              : "text-[var(--gray-text)] hover:text-[var(--accent-yellow)]"
                          )}
                          aria-label={
                            board.pinned
                              ? `Unpin ${board.name}`
                              : `Pin ${board.name}`
                          }
                          data-testid={`pin-${board.id}`}
                          title={board.pinned ? "Unpin board" : "Pin board"}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 fill-current"
                            aria-hidden="true"
                          >
                            <path d="M12 2l2.5 6.5L21 9l-5 4.5L17.5 21 12 17l-5.5 4L8 13.5 3 9l6.5-.5L12 2z" />
                          </svg>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBoardId(board.id);
                          setDraftName(board.name);
                        }}
                        className="rounded-md p-1 text-xs text-[var(--gray-text)] transition hover:bg-white hover:text-[var(--navy-dark)]"
                        aria-label={`Rename ${board.name}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                          <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.41L18.2 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2-1.66z" />
                        </svg>
                      </button>
                      {boards.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(board.id, board.name)}
                          className="rounded-md p-1 text-xs text-[var(--gray-text)] transition hover:bg-white hover:text-[var(--secondary-purple)]"
                          aria-label={`Delete ${board.name}`}
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                            <path d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12l-1 14H7L6 7z" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
            {boards.length === 0 ? (
              <li className="px-2 py-2 text-center text-xs text-[var(--gray-text)]">
                No boards yet.
              </li>
            ) : null}
          </ul>
          <div className="border-t border-[var(--stroke)] p-1">
            {showCreate ? (
              <form onSubmit={handleCreate} className="space-y-1.5">
                <input
                  autoFocus
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="New board name"
                  className="w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                  aria-label="New board name"
                  maxLength={80}
                />
                {templates && templates.length > 0 ? (
                  <select
                    value={selectedTemplate}
                    onChange={(event) => setSelectedTemplate(event.target.value)}
                    className="w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                    aria-label="Board template"
                    data-testid="template-select"
                  >
                    <option value="">Empty board</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="flex items-center gap-1">
                  <button
                    type="submit"
                    disabled={busy || !draftName.trim()}
                    className="rounded-md bg-[var(--secondary-purple)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white disabled:opacity-60"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setDraftName("");
                      setSelectedTemplate("");
                    }}
                    className="rounded-md border border-[var(--stroke)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowCreate(true);
                  setDraftName("");
                }}
                className="flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary-blue)] hover:bg-[var(--surface-muted)]"
                data-testid="create-board-button"
              >
                + New board
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
