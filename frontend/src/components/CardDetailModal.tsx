"use client";

import clsx from "clsx";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Markdown from "react-markdown";
import {
  createId,
  formatDuration,
  isOverdue,
  openTimeEntry,
  parseMentions,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  subtaskProgress,
  totalTrackedSeconds,
  type Attachment,
  type Card,
  type CardPriority,
  type Comment,
  type SubTask,
  type TimeEntry,
} from "@/lib/kanban";

type CardDetailModalProps = {
  card: Card;
  columnTitle?: string;
  canEdit: boolean;
  currentUser?: string;
  allCards?: Record<string, Card>;
  onChange: (patch: Partial<Card>) => void;
  onDelete?: () => void;
  onClose: () => void;
  onJumpToCard?: (cardId: string) => void;
};

const formatDate = (iso: string | undefined): string => {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const renderCommentBody = (body: string) =>
  parseMentions(body).map((segment, index) =>
    segment.kind === "mention" ? (
      <span
        key={`m-${index}`}
        className="rounded bg-[var(--primary-blue)]/15 px-1 font-semibold text-[var(--primary-blue)]"
      >
        @{segment.username}
      </span>
    ) : (
      <span key={`t-${index}`}>{segment.value}</span>
    )
  );

export function CardDetailModal({
  card,
  columnTitle,
  canEdit,
  currentUser,
  allCards,
  onChange,
  onDelete,
  onClose,
  onJumpToCard,
}: CardDetailModalProps) {
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [detailsDraft, setDetailsDraft] = useState(card.details);
  const [editingDescription, setEditingDescription] = useState(false);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [labelsDraft, setLabelsDraft] = useState((card.labels ?? []).join(", "));
  const [editingLabels, setEditingLabels] = useState(false);
  const [assigneeDraft, setAssigneeDraft] = useState(card.assignee ?? "");
  const [editingAssignee, setEditingAssignee] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const subtasks = card.subtasks ?? [];
  const progress = subtaskProgress(card);
  const comments = card.comments ?? [];
  const overdue = isOverdue(card.dueDate);
  const attachments = card.attachments ?? [];
  const [attachLabel, setAttachLabel] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachError, setAttachError] = useState<string | null>(null);

  const open = openTimeEntry(card);
  const totalSeconds = totalTrackedSeconds(card);

  const handleAddAttachment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = attachLabel.trim();
    const url = attachUrl.trim();
    if (!label || !url) {
      setAttachError("Label and URL are required.");
      return;
    }
    const lowered = url.toLowerCase();
    if (!(lowered.startsWith("http://") || lowered.startsWith("https://"))) {
      setAttachError("URL must start with http:// or https://");
      return;
    }
    const next: Attachment[] = [
      ...attachments,
      { id: createId("at"), label, url },
    ];
    onChange({ attachments: next });
    setAttachLabel("");
    setAttachUrl("");
    setAttachError(null);
  };

  const handleRemoveAttachment = (id: string) => {
    onChange({
      attachments: attachments.filter((entry) => entry.id !== id),
    });
  };

  const handleStartTimer = () => {
    const next: TimeEntry[] = [
      ...(card.timeEntries ?? []),
      { id: createId("te"), startedAt: new Date().toISOString() },
    ];
    onChange({ timeEntries: next });
  };

  const handleStopTimer = () => {
    if (!open) return;
    const ended = new Date();
    const seconds = Math.max(
      0,
      Math.floor((ended.getTime() - Date.parse(open.startedAt)) / 1000)
    );
    onChange({
      timeEntries: (card.timeEntries ?? []).map((entry) =>
        entry.id === open.id
          ? {
              ...entry,
              endedAt: ended.toISOString(),
              seconds,
            }
          : entry
      ),
    });
  };

  const handleSaveTitle = () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === card.title) {
      setTitleDraft(card.title);
      return;
    }
    onChange({ title: trimmed });
  };

  const handleSaveDescription = () => {
    onChange({ details: detailsDraft });
    setEditingDescription(false);
  };

  const handleAddSubtask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newSubtask.trim();
    if (!trimmed) return;
    const next: SubTask[] = [
      ...subtasks,
      { id: createId("sub"), title: trimmed, done: false },
    ];
    onChange({ subtasks: next });
    setNewSubtask("");
  };

  const handleToggleSubtask = (id: string) => {
    onChange({
      subtasks: subtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, done: !subtask.done } : subtask
      ),
    });
  };

  const handleDeleteSubtask = (id: string) => {
    const next = subtasks.filter((subtask) => subtask.id !== id);
    onChange({ subtasks: next.length > 0 ? next : undefined });
  };

  const handleAddComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = newComment.trim();
    if (!body) return;
    const author = currentUser ?? "anonymous";
    const next: Comment[] = [
      ...comments,
      {
        id: createId("cm"),
        author,
        body,
        createdAt: new Date().toISOString(),
      },
    ];
    onChange({ comments: next });
    setNewComment("");
  };

  const handleDeleteComment = (id: string) => {
    onChange({ comments: comments.filter((c) => c.id !== id) });
  };

  const handlePriorityChange = (value: CardPriority | "") => {
    onChange({ priority: value || undefined });
  };

  const handleDueDateChange = (value: string) => {
    onChange({ dueDate: value || undefined });
  };

  const handleSaveLabels = () => {
    const list = labelsDraft
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
    onChange({ labels: list.length > 0 ? list : undefined });
    setEditingLabels(false);
  };

  const handleSaveAssignee = () => {
    onChange({ assignee: assigneeDraft.trim() || undefined });
    setEditingAssignee(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label={`Card details for ${card.title}`}
      data-testid="card-detail-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl rounded-2xl border border-[var(--stroke)] bg-white p-6 shadow-[var(--shadow)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-[var(--stroke)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
          aria-label="Close card"
          data-testid="card-modal-close"
        >
          Close
        </button>

        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          {columnTitle ?? "Card"}
        </p>
        {canEdit ? (
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            className="mt-1 w-full rounded-md border border-transparent bg-transparent font-display text-2xl font-semibold text-[var(--navy-dark)] outline-none transition focus:border-[var(--stroke)] focus:bg-[var(--surface-muted)]"
            aria-label="Card title"
            data-testid="card-modal-title"
          />
        ) : (
          <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--navy-dark)]">
            {card.title}
          </h2>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Priority
            </p>
            {canEdit ? (
              <select
                value={card.priority ?? ""}
                onChange={(event) =>
                  handlePriorityChange(event.target.value as CardPriority | "")
                }
                className="mt-1 w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Priority"
              >
                <option value="">None</option>
                {PRIORITY_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABEL[value]}
                  </option>
                ))}
              </select>
            ) : card.priority ? (
              <p
                className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
                style={{
                  background: `${PRIORITY_DOT[card.priority]}1f`,
                  color: PRIORITY_DOT[card.priority],
                }}
              >
                {PRIORITY_LABEL[card.priority]}
              </p>
            ) : (
              <p className="mt-1 text-[var(--gray-text)]">—</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Due date
            </p>
            {canEdit ? (
              <input
                type="date"
                value={card.dueDate ?? ""}
                onChange={(event) => handleDueDateChange(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Due date"
              />
            ) : (
              <p
                className={clsx(
                  "mt-1",
                  overdue ? "font-semibold text-[#b91c1c]" : "text-[var(--navy-dark)]"
                )}
              >
                {card.dueDate ? formatDate(card.dueDate) : "—"}
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Assignee
            </p>
            {canEdit && editingAssignee ? (
              <div className="mt-1 flex items-center gap-1">
                <input
                  value={assigneeDraft}
                  onChange={(event) => setAssigneeDraft(event.target.value)}
                  className="flex-1 rounded-lg border border-[var(--stroke)] px-2 py-1 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                  aria-label="Assignee"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveAssignee}
                  className="rounded-md bg-[var(--secondary-purple)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => canEdit && setEditingAssignee(true)}
                className={clsx(
                  "mt-1 inline-flex w-full items-center rounded-lg px-2 py-1 text-left",
                  canEdit && "hover:bg-[var(--surface-muted)]"
                )}
              >
                {card.assignee ? (
                  <span className="rounded-full bg-[var(--primary-blue)]/10 px-2 py-0.5 font-semibold text-[var(--primary-blue)]">
                    @{card.assignee}
                  </span>
                ) : (
                  <span className="text-[var(--gray-text)]">—</span>
                )}
              </button>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Labels
            </p>
            {canEdit && editingLabels ? (
              <div className="mt-1 flex items-center gap-1">
                <input
                  value={labelsDraft}
                  onChange={(event) => setLabelsDraft(event.target.value)}
                  className="flex-1 rounded-lg border border-[var(--stroke)] px-2 py-1 text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                  aria-label="Labels (comma-separated)"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveLabels}
                  className="rounded-md bg-[var(--secondary-purple)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => canEdit && setEditingLabels(true)}
                className={clsx(
                  "mt-1 flex w-full flex-wrap gap-1 rounded-lg px-2 py-1 text-left",
                  canEdit && "hover:bg-[var(--surface-muted)]"
                )}
              >
                {(card.labels ?? []).length === 0 ? (
                  <span className="text-[var(--gray-text)]">—</span>
                ) : (
                  card.labels?.map((label) => (
                    <span
                      key={label}
                      className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 font-semibold text-[var(--navy-dark)]"
                    >
                      {label}
                    </span>
                  ))
                )}
              </button>
            )}
          </div>
        </div>

        <section className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Description
          </p>
          {canEdit && editingDescription ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={detailsDraft}
                onChange={(event) => setDetailsDraft(event.target.value)}
                rows={6}
                className="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Description"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDescription}
                  className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDetailsDraft(card.details);
                    setEditingDescription(false);
                  }}
                  className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => canEdit && setEditingDescription(true)}
              className={clsx(
                "mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm leading-6 text-[var(--gray-text)]",
                canEdit && "hover:bg-[var(--surface-muted)]"
              )}
              data-testid="card-modal-description"
            >
              {card.details && (
                <div className="text-[var(--gray-text)] [&_strong]:text-[var(--navy-dark)] [&_p]:mb-1 [&_p:last-child]:mb-0">
                  <Markdown>{card.details}</Markdown>
                </div>
              )}
              {!card.details && (
                <span className="italic text-[var(--gray-text)]">
                  {canEdit ? "Click to add a description." : "No description."}
                </span>
              )}
            </button>
          )}
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Checklist
            </p>
            {progress ? (
              <p className="text-[10px] font-semibold tabular-nums text-[var(--gray-text)]">
                {progress.done}/{progress.total}
              </p>
            ) : null}
          </div>
          {progress ? (
            <div className="mb-2 mt-1 h-1.5 w-full rounded-full bg-[var(--surface-muted)]">
              <div
                className="h-1.5 rounded-full bg-[var(--primary-blue)] transition-all"
                style={{
                  width: `${(progress.done / progress.total) * 100}%`,
                }}
              />
            </div>
          ) : null}
          <ul className="space-y-1.5" data-testid="card-modal-subtasks">
            {subtasks.map((subtask) => (
              <li
                key={subtask.id}
                className="group/sub flex items-center gap-2"
              >
                <input
                  type="checkbox"
                  checked={subtask.done}
                  onChange={() => handleToggleSubtask(subtask.id)}
                  disabled={!canEdit}
                  aria-label={`Toggle ${subtask.title}`}
                  className="h-4 w-4 cursor-pointer accent-[var(--primary-blue)] disabled:cursor-default"
                />
                <span
                  className={clsx(
                    "flex-1 text-sm",
                    subtask.done
                      ? "text-[var(--gray-text)] line-through"
                      : "text-[var(--navy-dark)]"
                  )}
                >
                  {subtask.title}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="text-[10px] text-[var(--gray-text)] opacity-0 transition group-hover/sub:opacity-100 hover:text-[var(--secondary-purple)]"
                    aria-label={`Remove ${subtask.title}`}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <form
              onSubmit={handleAddSubtask}
              className="mt-2 flex items-center gap-1"
            >
              <input
                value={newSubtask}
                onChange={(event) => setNewSubtask(event.target.value)}
                placeholder="+ Add a subtask"
                className="flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-[12px] text-[var(--navy-dark)] outline-none transition focus:border-[var(--stroke)] focus:bg-[var(--surface-muted)]"
                aria-label="Add a subtask"
              />
              {newSubtask.trim() ? (
                <button
                  type="submit"
                  className="rounded-md bg-[var(--secondary-purple)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
                >
                  Add
                </button>
              ) : null}
            </form>
          ) : null}
        </section>

        <section className="mt-5" data-testid="linked-cards-section">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Linked cards
          </p>
          {(card.linkedCardIds ?? []).length === 0 ? (
            <p className="mt-1 text-xs text-[var(--gray-text)]">
              No links yet.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {(card.linkedCardIds ?? []).map((linkedId) => {
                const linked = allCards?.[linkedId];
                return (
                  <li
                    key={linkedId}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--stroke)] px-2 py-1"
                    data-testid={`linked-card-${linkedId}`}
                  >
                    <button
                      type="button"
                      onClick={() => onJumpToCard?.(linkedId)}
                      className="flex-1 truncate text-left text-sm text-[var(--navy-dark)] hover:text-[var(--primary-blue)]"
                    >
                      {linked?.archived ? "🗄 " : ""}
                      {linked?.title ?? `(missing card ${linkedId})`}
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            linkedCardIds: (card.linkedCardIds ?? []).filter(
                              (id) => id !== linkedId
                            ),
                          })
                        }
                        className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] hover:text-[var(--secondary-purple)]"
                        aria-label={`Unlink ${linked?.title ?? linkedId}`}
                      >
                        Unlink
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {canEdit && allCards ? (
            <select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (!value || value === card.id) return;
                const existing = card.linkedCardIds ?? [];
                if (existing.includes(value)) return;
                onChange({ linkedCardIds: [...existing, value] });
              }}
              className="mt-2 w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              aria-label="Link to another card"
              data-testid="link-card-select"
            >
              <option value="">+ Link another card…</option>
              {Object.values(allCards)
                .filter(
                  (other) =>
                    other.id !== card.id &&
                    !other.archived &&
                    !(card.linkedCardIds ?? []).includes(other.id)
                )
                .map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.title}
                  </option>
                ))}
            </select>
          ) : null}
        </section>

        <section className="mt-5" data-testid="attachments-section">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Attachments
          </p>
          {attachments.length === 0 ? (
            <p className="mt-1 text-xs text-[var(--gray-text)]">
              No attachments yet.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {attachments.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--stroke)] px-2 py-1"
                  data-testid={`attachment-${entry.id}`}
                >
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-sm text-[var(--primary-blue)] hover:underline"
                  >
                    {entry.label}
                  </a>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(entry.id)}
                      className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] hover:text-[var(--secondary-purple)]"
                      aria-label={`Remove attachment ${entry.label}`}
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canEdit ? (
            <form
              onSubmit={handleAddAttachment}
              className="mt-2 grid grid-cols-[1fr_2fr_auto] gap-1"
              data-testid="attachment-form"
            >
              <input
                value={attachLabel}
                onChange={(event) => setAttachLabel(event.target.value)}
                placeholder="Label"
                aria-label="Attachment label"
                className="rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                maxLength={80}
              />
              <input
                value={attachUrl}
                onChange={(event) => setAttachUrl(event.target.value)}
                placeholder="https://…"
                aria-label="Attachment URL"
                className="rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              />
              <button
                type="submit"
                className="rounded-md bg-[var(--secondary-purple)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
              >
                Add
              </button>
              {attachError ? (
                <p
                  role="alert"
                  className="col-span-3 text-[11px] text-[var(--secondary-purple)]"
                >
                  {attachError}
                </p>
              ) : null}
            </form>
          ) : null}
        </section>

        <section className="mt-5" data-testid="time-tracking-section">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Time tracked
            </p>
            <p className="text-[12px] font-semibold tabular-nums text-[var(--navy-dark)]">
              {formatDuration(totalSeconds)}
              {open ? " (running)" : ""}
            </p>
          </div>
          {canEdit ? (
            <div className="mt-1">
              {open ? (
                <button
                  type="button"
                  onClick={handleStopTimer}
                  className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white"
                  data-testid="stop-timer"
                >
                  Stop timer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)] hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                  data-testid="start-timer"
                >
                  Start timer
                </button>
              )}
            </div>
          ) : null}
        </section>

        <section className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Comments ({comments.length})
          </p>
          <ul className="mt-2 space-y-2" data-testid="card-modal-comments">
            {comments.length === 0 ? (
              <li className="text-xs text-[var(--gray-text)]">
                No comments yet.
              </li>
            ) : (
              comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-lg border border-[var(--stroke)] bg-white px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2 text-[10px]">
                    <span className="font-semibold text-[var(--primary-blue)]">
                      @{comment.author}
                    </span>
                    {comment.author === currentUser ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        className="text-[var(--gray-text)] hover:text-[var(--secondary-purple)]"
                        aria-label={`Delete comment by ${comment.author}`}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--navy-dark)]">
                    {renderCommentBody(comment.body)}
                  </p>
                </li>
              ))
            )}
          </ul>
          {currentUser ? (
            <form
              onSubmit={handleAddComment}
              className="mt-2 flex items-start gap-2"
            >
              <textarea
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
                rows={2}
                placeholder="Add a comment… use @username to notify someone"
                className="flex-1 resize-none rounded-lg border border-[var(--stroke)] px-2 py-1 text-[13px] text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                aria-label="Add a comment"
              />
              {newComment.trim() ? (
                <button
                  type="submit"
                  className="rounded-md bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white"
                >
                  Post
                </button>
              ) : null}
            </form>
          ) : null}
        </section>

        {canEdit ? (
          <div className="mt-5 flex items-center justify-end gap-2 border-t border-[var(--stroke)] pt-3">
            <button
              type="button"
              onClick={() => onChange({ archived: !card.archived })}
              className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
              data-testid="card-modal-archive"
            >
              {card.archived ? "Restore" : "Archive"}
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Delete this card permanently?")) {
                    onDelete();
                  }
                }}
                className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--secondary-purple)] hover:bg-[var(--secondary-purple)]/5"
                data-testid="card-modal-delete"
              >
                Delete
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
