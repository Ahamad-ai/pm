"use client";

import clsx from "clsx";
import { useState, type FormEvent } from "react";
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  type CardFilter,
  type CardPriority,
  type SavedView,
} from "@/lib/kanban";

type CardFilterBarProps = {
  filter: CardFilter;
  availableLabels: string[];
  availableAssignees: string[];
  onChange: (next: CardFilter) => void;
  matchCount: number;
  totalCount: number;
  savedViews?: SavedView[];
  canEditViews?: boolean;
  onSaveView?: (name: string, filter: CardFilter) => Promise<void> | void;
  onDeleteView?: (id: string) => Promise<void> | void;
};

function togglePill<T extends string>(values: T[] | undefined, value: T): T[] {
  const list = values ?? [];
  return list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
}

function isEmpty(filter: CardFilter): boolean {
  if (filter.query) return false;
  if (filter.priorities && filter.priorities.length > 0) return false;
  if (filter.labels && filter.labels.length > 0) return false;
  if (filter.assignees && filter.assignees.length > 0) return false;
  if (filter.overdueOnly) return false;
  return true;
}

export function CardFilterBar({
  filter,
  availableLabels,
  availableAssignees,
  onChange,
  matchCount,
  totalCount,
  savedViews,
  canEditViews,
  onSaveView,
  onDeleteView,
}: CardFilterBarProps) {
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [viewNameDraft, setViewNameDraft] = useState("");
  const handleClear = () => onChange({});
  const empty = isEmpty(filter);

  const handleSaveView = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSaveView) return;
    const name = viewNameDraft.trim();
    if (!name) return;
    await onSaveView(name, filter);
    setSavePromptOpen(false);
    setViewNameDraft("");
  };

  return (
    <section
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white/85 p-3 shadow-[var(--shadow-soft)] backdrop-blur"
      aria-label="Card filters"
      data-testid="card-filter-bar"
    >
      {savedViews && savedViews.length > 0 ? (
        <select
          value=""
          onChange={(event) => {
            const id = event.target.value;
            if (!id) return;
            const view = savedViews.find((v) => v.id === id);
            if (view) {
              onChange({ ...view.filter });
            }
          }}
          className="rounded-xl border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          aria-label="Apply saved view"
          data-testid="apply-saved-view"
        >
          <option value="">Saved views…</option>
          {savedViews.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
      ) : null}
      <input
        type="search"
        placeholder="Search cards…"
        value={filter.query ?? ""}
        onChange={(event) =>
          onChange({ ...filter, query: event.target.value })
        }
        className="min-w-[160px] flex-1 rounded-xl border border-[var(--stroke)] bg-white px-3 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
        aria-label="Search cards"
      />
      <div className="flex flex-wrap items-center gap-1">
        {PRIORITY_ORDER.map((priority: CardPriority) => {
          const active = (filter.priorities ?? []).includes(priority);
          return (
            <button
              key={priority}
              type="button"
              onClick={() =>
                onChange({
                  ...filter,
                  priorities: togglePill(filter.priorities, priority),
                })
              }
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] transition",
                active
                  ? "border-[var(--secondary-purple)] bg-[var(--secondary-purple)]/10 text-[var(--secondary-purple)]"
                  : "border-[var(--stroke)] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              )}
              aria-pressed={active}
              data-testid={`filter-priority-${priority}`}
            >
              {PRIORITY_LABEL[priority]}
            </button>
          );
        })}
      </div>
      {availableLabels.length > 0 ? (
        <select
          value=""
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            onChange({
              ...filter,
              labels: togglePill(filter.labels, value),
            });
          }}
          className="rounded-xl border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          aria-label="Filter by label"
        >
          <option value="">+ Label</option>
          {availableLabels.map((label) => (
            <option key={label} value={label}>
              {(filter.labels ?? []).includes(label) ? "✓ " : ""}
              {label}
            </option>
          ))}
        </select>
      ) : null}
      {availableAssignees.length > 0 ? (
        <select
          value=""
          onChange={(event) => {
            const value = event.target.value;
            if (!value) return;
            onChange({
              ...filter,
              assignees: togglePill(filter.assignees, value),
            });
          }}
          className="rounded-xl border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          aria-label="Filter by assignee"
        >
          <option value="">+ Assignee</option>
          {availableAssignees.map((assignee) => (
            <option key={assignee} value={assignee}>
              {(filter.assignees ?? []).includes(assignee) ? "✓ " : ""}@
              {assignee}
            </option>
          ))}
        </select>
      ) : null}
      <label className="inline-flex items-center gap-1.5 rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)]">
        <input
          type="checkbox"
          checked={Boolean(filter.overdueOnly)}
          onChange={(event) =>
            onChange({ ...filter, overdueOnly: event.target.checked })
          }
        />
        Overdue
      </label>

      {(filter.labels ?? []).map((label) => (
        <span
          key={`label-${label}`}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--navy-dark)]"
        >
          {label}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filter,
                labels: togglePill(filter.labels, label),
              })
            }
            aria-label={`Remove label filter ${label}`}
            className="rounded-full p-0.5 text-[var(--gray-text)] hover:text-[var(--secondary-purple)]"
          >
            ×
          </button>
        </span>
      ))}
      {(filter.assignees ?? []).map((assignee) => (
        <span
          key={`assignee-${assignee}`}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-blue)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--primary-blue)]"
        >
          @{assignee}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filter,
                assignees: togglePill(filter.assignees, assignee),
              })
            }
            aria-label={`Remove assignee filter ${assignee}`}
            className="rounded-full p-0.5 hover:text-[var(--secondary-purple)]"
          >
            ×
          </button>
        </span>
      ))}

      <span
        className="ml-auto text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
        aria-live="polite"
      >
        {empty ? `${totalCount} cards` : `${matchCount} of ${totalCount} cards`}
      </span>
      {!empty ? (
        <button
          type="button"
          onClick={handleClear}
          className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          data-testid="clear-filter"
        >
          Clear
        </button>
      ) : null}
      {!empty && canEditViews && onSaveView ? (
        savePromptOpen ? (
          <form
            onSubmit={handleSaveView}
            className="flex items-center gap-1"
            data-testid="save-view-form"
          >
            <input
              autoFocus
              value={viewNameDraft}
              onChange={(event) => setViewNameDraft(event.target.value)}
              placeholder="View name"
              className="rounded-xl border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              aria-label="Saved view name"
              maxLength={60}
            />
            <button
              type="submit"
              disabled={!viewNameDraft.trim()}
              className="rounded-full bg-[var(--secondary-purple)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setSavePromptOpen(false);
                setViewNameDraft("");
              }}
              className="rounded-full border border-[var(--stroke)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSavePromptOpen(true)}
            className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--primary-blue)] hover:bg-[var(--primary-blue)]/10"
            data-testid="save-view"
          >
            Save view
          </button>
        )
      ) : null}
      {savedViews && savedViews.length > 0 && canEditViews && onDeleteView ? (
        <details className="text-[10px] text-[var(--gray-text)]">
          <summary className="cursor-pointer">Manage views</summary>
          <ul className="mt-1 space-y-0.5">
            {savedViews.map((view) => (
              <li
                key={view.id}
                className="flex items-center justify-between gap-2"
              >
                <span>{view.name}</span>
                <button
                  type="button"
                  onClick={() => onDeleteView(view.id)}
                  className="text-[var(--secondary-purple)]"
                  aria-label={`Delete saved view ${view.name}`}
                  data-testid={`delete-view-${view.id}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
