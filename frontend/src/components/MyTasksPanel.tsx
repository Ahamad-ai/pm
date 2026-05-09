"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { fetchMyTasks, type UserTask } from "@/lib/boardApi";
import { PRIORITY_DOT, PRIORITY_LABEL } from "@/lib/kanban";

type MyTasksPanelProps = {
  username: string;
  isOpen: boolean;
  onClose: () => void;
  onJumpToBoard?: (boardId: number) => void;
  refreshKey?: number;
};

const formatDue = (task: UserTask): string => {
  if (!task.due_date) return "No due date";
  if (task.overdue) return `Overdue · ${task.due_date}`;
  if (task.due_in_days === 0) return "Due today";
  if (task.due_in_days === 1) return "Due tomorrow";
  if (task.due_in_days != null && task.due_in_days > 0) {
    return `Due in ${task.due_in_days} days`;
  }
  return `Due ${task.due_date}`;
};

export const MyTasksPanel = ({
  username,
  isOpen,
  onClose,
  onJumpToBoard,
  refreshKey,
}: MyTasksPanelProps) => {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const next = await fetchMyTasks(username);
        if (!cancelled) {
          setTasks(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load tasks.");
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
  }, [username, isOpen, refreshKey]);

  if (!isOpen) {
    return null;
  }

  const overdueCount = tasks.filter((task) => task.overdue).length;
  const dueSoonCount = tasks.filter(
    (task) => !task.overdue && task.due_in_days != null && task.due_in_days <= 3
  ).length;

  return (
    <aside
      className="fixed left-1/2 top-20 z-40 w-[640px] max-w-[95vw] -translate-x-1/2 rounded-2xl border border-[var(--stroke)] bg-white p-5 shadow-[var(--shadow)]"
      role="dialog"
      aria-label="My tasks"
      data-testid="my-tasks-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            My Tasks
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--navy-dark)]">
            Cards assigned to @{username}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
          aria-label="Close my tasks"
        >
          Close
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.15em]">
        <span className="text-[var(--navy-dark)]">{tasks.length} total</span>
        {overdueCount > 0 ? (
          <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[#b91c1c]">
            {overdueCount} overdue
          </span>
        ) : null}
        {dueSoonCount > 0 ? (
          <span className="rounded-full bg-[var(--accent-yellow)]/15 px-2 py-0.5 text-[#a07000]">
            {dueSoonCount} due soon
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-[var(--secondary-purple)]/20 bg-[var(--secondary-purple)]/5 px-3 py-2 text-xs text-[var(--secondary-purple)]"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-[var(--gray-text)]">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="text-xs text-[var(--gray-text)]">
            Nothing assigned to you. Set a card&apos;s assignee to your username
            to see it here.
          </p>
        ) : (
          tasks.map((task) => (
            <button
              key={`${task.board_id}-${task.card_id}`}
              type="button"
              onClick={() => onJumpToBoard?.(task.board_id)}
              className="flex w-full items-start justify-between gap-3 rounded-xl border border-[var(--stroke)] px-3 py-2 text-left hover:border-[var(--primary-blue)] hover:bg-[var(--surface-muted)]"
              data-testid={`task-${task.board_id}-${task.card_id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {task.priority ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]"
                      style={{
                        background: `${PRIORITY_DOT[task.priority]}1f`,
                        color: PRIORITY_DOT[task.priority],
                      }}
                    >
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                  ) : null}
                  <p className="truncate text-sm font-semibold text-[var(--navy-dark)]">
                    {task.title}
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--gray-text)]">
                  {task.board_name}
                  {task.column_title ? ` · ${task.column_title}` : ""}
                </p>
              </div>
              <span
                className={clsx(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]",
                  task.overdue
                    ? "bg-[#fee2e2] text-[#b91c1c]"
                    : task.due_in_days != null && task.due_in_days <= 3
                    ? "bg-[var(--accent-yellow)]/15 text-[#a07000]"
                    : "bg-[var(--surface-muted)] text-[var(--gray-text)]"
                )}
              >
                {formatDue(task)}
              </span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
