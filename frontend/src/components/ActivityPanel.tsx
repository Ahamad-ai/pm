"use client";

import { useEffect, useState } from "react";
import { fetchActivity, type ActivityEntry } from "@/lib/boardApi";

type ActivityPanelProps = {
  username: string;
  boardId: number | null;
  isOpen: boolean;
  onClose: () => void;
  refreshKey?: number;
};

const ACTION_LABEL: Record<string, string> = {
  "board.created": "Board created",
  "board.renamed": "Board renamed",
  "board.updated": "Board updated",
  "board.ai_updated": "AI updated board",
};

const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const detailFor = (entry: ActivityEntry): string => {
  const details = entry.details;
  if (!details) return "";
  if (typeof details === "string") return details;
  if (typeof details === "object" && !Array.isArray(details)) {
    const obj = details as Record<string, unknown>;
    if ("from" in obj && "to" in obj) {
      return `${obj.from} → ${obj.to}`;
    }
    if ("summary" in obj) {
      return String(obj.summary);
    }
    if ("name" in obj) {
      return String(obj.name);
    }
    if ("columns" in obj && "cards" in obj) {
      return `${obj.columns} columns · ${obj.cards} cards`;
    }
  }
  return "";
};

function renderEntries(
  entries: ActivityEntry[],
  isLoading: boolean,
  error: string | null
) {
  if (isLoading) {
    return <p className="text-xs text-[var(--gray-text)]">Loading…</p>;
  }
  if (error) {
    return (
      <p className="text-xs text-[var(--secondary-purple)]" role="alert">
        {error}
      </p>
    );
  }
  if (entries.length === 0) {
    return <p className="text-xs text-[var(--gray-text)]">No activity yet.</p>;
  }
  return (
    <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="rounded-xl border border-[var(--stroke)] px-3 py-2"
          data-testid={`activity-entry-${entry.id}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--secondary-purple)]">
              {ACTION_LABEL[entry.action] ?? entry.action}
            </span>
            <span className="text-[10px] text-[var(--gray-text)]">
              {formatTime(entry.created_at)}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[var(--navy-dark)]">
            {detailFor(entry) || `by ${entry.username}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ActivityPanel({
  username,
  boardId,
  isOpen,
  onClose,
  refreshKey,
}: ActivityPanelProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || boardId === null) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const rows = await fetchActivity(username, boardId);
        if (!cancelled) {
          setEntries(rows);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Could not load activity.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [username, boardId, isOpen, refreshKey]);

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className="fixed right-[400px] top-16 z-30 w-80 rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-[var(--shadow)]"
      aria-label="Activity feed"
      data-testid="activity-panel"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]">
          Activity
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--stroke)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          aria-label="Close activity panel"
        >
          Close
        </button>
      </div>
      {renderEntries(entries, isLoading, error)}
    </aside>
  );
}
