"use client";

import { useEffect, useState } from "react";
import { fetchBoardStats, type BoardStats } from "@/lib/boardApi";
import { PRIORITY_DOT, PRIORITY_LABEL, type CardPriority } from "@/lib/kanban";

type BoardStatsStripProps = {
  username: string;
  boardId: number | null;
  refreshKey?: number;
};

type StatTone = "default" | "danger" | "muted";

type StatProps = {
  label: string;
  value: string | number;
  tone?: StatTone;
};

function toneClass(tone: StatTone): string {
  switch (tone) {
    case "danger":
      return "text-[#b91c1c]";
    case "muted":
      return "text-[var(--gray-text)]";
    default:
      return "text-[var(--navy-dark)]";
  }
}

function Stat({ label, value, tone = "default" }: StatProps) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
        {label}
      </span>
      <span className={`font-display text-lg font-semibold ${toneClass(tone)}`}>
        {value}
      </span>
    </div>
  );
}

export function BoardStatsStrip({
  username,
  boardId,
  refreshKey,
}: BoardStatsStripProps) {
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (boardId === null) {
        if (!cancelled) {
          setStats(null);
        }
        return;
      }
      try {
        const next = await fetchBoardStats(username, boardId);
        if (!cancelled) {
          setStats(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load stats.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [username, boardId, refreshKey]);

  if (boardId === null || error || !stats) {
    return null;
  }

  const priorityEntries = (Object.keys(PRIORITY_LABEL) as CardPriority[])
    .filter((priority) => (stats.by_priority[priority] ?? 0) > 0)
    .map((priority) => ({
      label: PRIORITY_LABEL[priority],
      count: stats.by_priority[priority] ?? 0,
      color: PRIORITY_DOT[priority],
    }));

  return (
    <section
      className="flex flex-wrap items-center gap-6 rounded-2xl border border-[var(--stroke)] bg-white/85 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur"
      aria-label="Board statistics"
      data-testid="board-stats-strip"
    >
      <Stat label="Cards" value={stats.total_cards} />
      <Stat label="Columns" value={stats.total_columns} tone="muted" />
      <Stat
        label="Overdue"
        value={stats.overdue_count}
        tone={stats.overdue_count > 0 ? "danger" : "muted"}
      />
      <Stat
        label="With due date"
        value={stats.with_due_date}
        tone="muted"
      />
      {stats.subtasks.total > 0 ? (
        <Stat
          label="Subtasks"
          value={`${stats.subtasks.done}/${stats.subtasks.total}`}
        />
      ) : null}
      {priorityEntries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {priorityEntries.map((entry) => (
            <span
              key={entry.label}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: `${entry.color}1f`,
                color: entry.color,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: entry.color }}
                aria-hidden="true"
              />
              {entry.label} · {entry.count}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
