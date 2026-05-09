"use client";

import { useEffect, useState } from "react";

export type ShortcutHandlers = {
  onShowHelp?: () => void;
  onFocusSearch?: () => void;
  onToggleBulkSelect?: () => void;
  onShowBoard?: () => void;
  onShowCalendar?: () => void;
  onShowMyTasks?: () => void;
  onShowActivity?: () => void;
  onShowArchive?: () => void;
};

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
};

export const useKeyboardShortcuts = (handlers: ShortcutHandlers): void => {
  const {
    onShowHelp,
    onFocusSearch,
    onToggleBulkSelect,
    onShowBoard,
    onShowCalendar,
    onShowMyTasks,
    onShowActivity,
    onShowArchive,
  } = handlers;
  useEffect(() => {
    let pendingPrefix: string | null = null;
    let prefixTimer: number | null = null;

    const clearPrefix = () => {
      pendingPrefix = null;
      if (prefixTimer !== null) {
        window.clearTimeout(prefixTimer);
        prefixTimer = null;
      }
    };

    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key;

      // Two-key prefix: g
      if (pendingPrefix === "g") {
        clearPrefix();
        if (key === "b") {
          onShowBoard?.();
        } else if (key === "c") {
          onShowCalendar?.();
        } else if (key === "t") {
          onShowMyTasks?.();
        } else if (key === "a") {
          onShowActivity?.();
        } else if (key === "r") {
          onShowArchive?.();
        }
        return;
      }

      if (key === "?") {
        event.preventDefault();
        onShowHelp?.();
        return;
      }
      if (key === "/") {
        event.preventDefault();
        onFocusSearch?.();
        return;
      }
      if (key === "b") {
        onToggleBulkSelect?.();
        return;
      }
      if (key === "g") {
        pendingPrefix = "g";
        prefixTimer = window.setTimeout(() => clearPrefix(), 1500);
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      clearPrefix();
    };
  }, [
    onShowHelp,
    onFocusSearch,
    onToggleBulkSelect,
    onShowBoard,
    onShowCalendar,
    onShowMyTasks,
    onShowActivity,
    onShowArchive,
  ]);
};

const SHORTCUT_LIST: { keys: string; description: string }[] = [
  { keys: "?", description: "Show this help" },
  { keys: "/", description: "Focus the global search" },
  { keys: "b", description: "Toggle bulk-select mode" },
  { keys: "g  b", description: "Go to board view" },
  { keys: "g  c", description: "Go to calendar view" },
  { keys: "g  t", description: "Open My Tasks" },
  { keys: "g  a", description: "Toggle activity panel" },
  { keys: "g  r", description: "Toggle archive panel" },
  { keys: "Esc", description: "Close the open panel or modal" },
];

type KeyboardShortcutsHelpProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const KeyboardShortcutsHelp = ({
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-label="Keyboard shortcuts"
      data-testid="shortcuts-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-5 shadow-[var(--shadow)]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Help
            </p>
            <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--stroke)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
            aria-label="Close shortcuts"
          >
            Close
          </button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUT_LIST.map(({ keys, description }) => (
              <tr
                key={keys}
                className="border-t border-[var(--stroke)] first:border-t-0"
              >
                <td className="w-24 py-2 align-top">
                  {keys.split("  ").map((part, index, arr) => (
                    <span key={index} className="flex items-center gap-1">
                      <span className="rounded-md border border-[var(--stroke)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-[11px]">
                        {part}
                      </span>
                      {index < arr.length - 1 ? (
                        <span className="text-[10px] text-[var(--gray-text)]">
                          then
                        </span>
                      ) : null}
                    </span>
                  ))}
                </td>
                <td className="py-2 text-[12px] text-[var(--navy-dark)]">
                  {description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const useShortcutsOpenState = () => {
  const [open, setOpen] = useState(false);
  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
  };
};
