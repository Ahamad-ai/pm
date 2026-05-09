import { useState, type CSSProperties, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import Markdown from "react-markdown";
import {
  createId,
  isOverdue,
  parseMentions,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  subtaskProgress,
  type Card,
  type CardPriority,
  type Comment,
  type SubTask,
} from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  accentColor: string;
  canEdit?: boolean;
  currentUser?: string;
  selectMode?: boolean;
  isSelected?: boolean;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, patch: Partial<Card>) => void;
  onOpen?: (cardId: string) => void;
  onToggleSelect?: (cardId: string) => void;
};

const formatDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

export const KanbanCard = ({
  card,
  accentColor,
  canEdit = true,
  currentUser,
  selectMode = false,
  isSelected = false,
  onDelete,
  onEdit,
  onOpen,
  onToggleSelect,
}: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState("");
  const comments = card.comments ?? [];
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [detailsDraft, setDetailsDraft] = useState(card.details);
  const [priorityDraft, setPriorityDraft] = useState<CardPriority | "">(
    card.priority ?? ""
  );
  const [dueDateDraft, setDueDateDraft] = useState(card.dueDate ?? "");
  const [labelsDraft, setLabelsDraft] = useState((card.labels ?? []).join(", "));
  const [assigneeDraft, setAssigneeDraft] = useState(card.assignee ?? "");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const subtasks = card.subtasks ?? [];
  const progress = subtaskProgress(card);

  const updateSubtasks = (next: SubTask[]) => {
    onEdit(card.id, { subtasks: next.length > 0 ? next : undefined });
  };

  const handleToggleSubtask = (id: string) => {
    updateSubtasks(
      subtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, done: !subtask.done } : subtask
      )
    );
  };

  const handleAddSubtask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newSubtaskTitle.trim();
    if (!trimmed) return;
    updateSubtasks([
      ...subtasks,
      { id: createId("sub"), title: trimmed, done: false },
    ]);
    setNewSubtaskTitle("");
  };

  const handleDeleteSubtask = (id: string) => {
    updateSubtasks(subtasks.filter((subtask) => subtask.id !== id));
  };

  const handleAddComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = newCommentBody.trim();
    if (!body) return;
    const author = currentUser ?? "anonymous";
    const next: Comment = {
      id: createId("cm"),
      author,
      body,
      createdAt: new Date().toISOString(),
    };
    onEdit(card.id, { comments: [...comments, next] });
    setNewCommentBody("");
  };

  const handleDeleteComment = (id: string) => {
    onEdit(card.id, {
      comments: comments.filter((comment) => comment.id !== id),
    });
  };

  const handleToggleArchived = () => {
    onEdit(card.id, { archived: !card.archived });
  };

  const useSortableArgs =
    !canEdit || isEditing || selectMode
      ? { id: card.id, disabled: true }
      : { id: card.id };

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable(useSortableArgs);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: card.priority ? PRIORITY_DOT[card.priority] : accentColor,
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      return;
    }
    const nextDetails = detailsDraft.trim() || "No details yet.";
    const labels = labelsDraft
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
    onEdit(card.id, {
      title: nextTitle,
      details: nextDetails,
      priority: priorityDraft || undefined,
      dueDate: dueDateDraft || undefined,
      labels: labels.length > 0 ? labels : undefined,
      assignee: assigneeDraft.trim() || undefined,
    });
    setIsEditing(false);
  };

  const overdue = isOverdue(card.dueDate);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-[var(--stroke)] border-l-[3px] bg-white px-4 py-3.5 shadow-[var(--shadow-card)]",
        "transition-shadow duration-150",
        !isDragging && !isEditing && "hover:shadow-[var(--shadow-card-hover)]",
        isDragging && "opacity-60 shadow-[var(--shadow-card-hover)]",
        !isEditing && !isDragging && !selectMode && "cursor-grab active:cursor-grabbing",
        selectMode && "cursor-pointer",
        isSelected && "ring-2 ring-[var(--primary-blue)]/60"
      )}
      {...(!isEditing && !selectMode ? attributes : {})}
      {...(!isEditing && !selectMode ? listeners : {})}
      onClick={
        selectMode && onToggleSelect
          ? (event) => {
              event.stopPropagation();
              onToggleSelect(card.id);
            }
          : undefined
      }
      data-testid={`card-${card.id}`}
    >
      {selectMode ? (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect?.(card.id)}
          onClick={(event) => event.stopPropagation()}
          className="absolute left-2 top-3 h-4 w-4 cursor-pointer accent-[var(--primary-blue)]"
          aria-label={`Select card ${card.title}`}
          data-testid={`select-card-${card.id}`}
        />
      ) : null}
      {!isEditing ? (
        <span
          className="pointer-events-none absolute right-2.5 top-3 text-[var(--gray-text)] opacity-0 transition group-hover:opacity-50"
          aria-hidden="true"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </span>
      ) : null}

      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-2">
          <input
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            className="w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-sm font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
            aria-label={`Edit title for ${card.title}`}
          />
          <textarea
            value={detailsDraft}
            onChange={(event) => setDetailsDraft(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-[var(--stroke)] px-2 py-1 text-sm text-[var(--gray-text)] outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
            aria-label={`Edit details for ${card.title}`}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={priorityDraft}
              onChange={(event) =>
                setPriorityDraft(event.target.value as CardPriority | "")
              }
              className="rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              aria-label="Priority"
            >
              <option value="">Priority…</option>
              {PRIORITY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDateDraft}
              onChange={(event) => setDueDateDraft(event.target.value)}
              className="rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              aria-label="Due date"
            />
          </div>
          <input
            value={labelsDraft}
            onChange={(event) => setLabelsDraft(event.target.value)}
            placeholder="Labels (comma-separated)"
            className="w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Labels"
          />
          <input
            value={assigneeDraft}
            onChange={(event) => setAssigneeDraft(event.target.value)}
            placeholder="Assignee"
            className="w-full rounded-lg border border-[var(--stroke)] px-2 py-1 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="Assignee"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white shadow-[0_4px_10px_rgba(117,57,145,0.25)] transition hover:brightness-110"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setTitleDraft(card.title);
                setDetailsDraft(card.details);
                setPriorityDraft(card.priority ?? "");
                setDueDateDraft(card.dueDate ?? "");
                setLabelsDraft((card.labels ?? []).join(", "));
                setAssigneeDraft(card.assignee ?? "");
                setIsEditing(false);
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2 pr-5">
            {onOpen ? (
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onOpen(card.id)}
                className="text-left font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)] hover:text-[var(--primary-blue)]"
                data-testid={`open-card-${card.id}`}
              >
                {card.title}
              </button>
            ) : (
              <h4 className="font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)]">
                {card.title}
              </h4>
            )}
            {card.priority ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]"
                style={{
                  background: `${PRIORITY_DOT[card.priority]}1f`,
                  color: PRIORITY_DOT[card.priority],
                }}
                data-testid={`priority-${card.id}`}
              >
                {PRIORITY_LABEL[card.priority]}
              </span>
            ) : null}
          </div>
          <div
            className="mt-1.5 text-[13px] leading-6 text-[var(--gray-text)] [&_a]:text-[var(--primary-blue)] [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--surface-muted)] [&_code]:px-1 [&_code]:py-0.5 [&_p]:mb-1 [&_p:last-child]:mb-0 [&_strong]:text-[var(--navy-dark)] [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4"
            data-testid={`card-details-${card.id}`}
          >
            <Markdown
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {card.details}
            </Markdown>
          </div>
          {progress ? (
            <div className="mt-2.5" data-testid={`subtasks-${card.id}`}>
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                <span>Checklist</span>
                <span>
                  {progress.done}/{progress.total}
                </span>
              </div>
              <div className="mb-2 h-1.5 w-full rounded-full bg-[var(--surface-muted)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--primary-blue)] transition-all"
                  style={{
                    width: `${(progress.done / progress.total) * 100}%`,
                  }}
                />
              </div>
              <ul className="space-y-1">
                {subtasks.map((subtask) => (
                  <li
                    key={subtask.id}
                    className="group/sub flex items-center gap-1.5 text-[12px] text-[var(--navy-dark)]"
                  >
                    <input
                      type="checkbox"
                      checked={subtask.done}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={() => handleToggleSubtask(subtask.id)}
                      aria-label={`Toggle ${subtask.title}`}
                      className="h-3.5 w-3.5 cursor-pointer accent-[var(--primary-blue)]"
                    />
                    <span
                      className={clsx(
                        "flex-1 truncate",
                        subtask.done && "text-[var(--gray-text)] line-through"
                      )}
                    >
                      {subtask.title}
                    </span>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => handleDeleteSubtask(subtask.id)}
                      className="rounded p-0.5 text-[10px] text-[var(--gray-text)] opacity-0 transition group-hover/sub:opacity-100 hover:text-[var(--secondary-purple)]"
                      aria-label={`Remove ${subtask.title}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form
            onSubmit={handleAddSubtask}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="mt-2 flex items-center gap-1"
          >
            <input
              value={newSubtaskTitle}
              onChange={(event) => setNewSubtaskTitle(event.target.value)}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="+ Add subtask"
              className="flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-[var(--navy-dark)] outline-none transition placeholder:text-[var(--gray-text)] focus:border-[var(--stroke)] focus:bg-white"
              aria-label={`Add a subtask to ${card.title}`}
            />
            {newSubtaskTitle.trim() ? (
              <button
                type="submit"
                onPointerDown={(event) => event.stopPropagation()}
                className="rounded-md bg-[var(--secondary-purple)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
              >
                Add
              </button>
            ) : null}
          </form>

          {(card.labels && card.labels.length > 0) ||
          card.dueDate ||
          card.assignee ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
              {card.labels?.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 font-semibold text-[var(--navy-dark)]"
                >
                  {label}
                </span>
              ))}
              {card.dueDate ? (
                <span
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                    overdue
                      ? "bg-[#fee2e2] text-[#b91c1c]"
                      : "bg-emerald-50 text-emerald-700"
                  )}
                  data-testid={`due-${card.id}`}
                >
                  {overdue ? "Overdue" : "Due"} {formatDate(card.dueDate)}
                </span>
              ) : null}
              {card.assignee ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-blue)]/10 px-2 py-0.5 font-semibold text-[var(--primary-blue)]">
                  @{card.assignee}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-end gap-1 opacity-60 transition group-hover:opacity-100">
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setShowComments((value) => !value)}
              className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:bg-[var(--surface-muted)] hover:text-[var(--navy-dark)]"
              aria-label={`Toggle comments for ${card.title}`}
              data-testid={`toggle-comments-${card.id}`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
              </svg>
              {comments.length > 0 ? comments.length : ""}
            </button>
            {canEdit ? (
              <>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:bg-[var(--surface-muted)] hover:text-[var(--navy-dark)]"
                  aria-label={`Edit ${card.title}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                    <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zm17.71-10.04a1 1 0 0 0 0-1.41L18.2 3.29a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 2-1.66z" />
                  </svg>
                  Edit
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={handleToggleArchived}
                  className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:bg-[var(--surface-muted)] hover:text-[var(--navy-dark)]"
                  aria-label={`Archive ${card.title}`}
                  data-testid={`archive-${card.id}`}
                  title={card.archived ? "Restore" : "Archive"}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                    <path d="M3 3h18v4H3V3zm2 6h14v12H5V9zm4 3v2h6v-2H9z" />
                  </svg>
                  {card.archived ? "Restore" : "Archive"}
                </button>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onDelete(card.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--secondary-purple)]/30 hover:bg-[var(--secondary-purple)]/5 hover:text-[var(--secondary-purple)]"
                  aria-label={`Drop ${card.title}`}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                    <path d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12l-1 14H7L6 7z" />
                  </svg>
                  Drop
                </button>
              </>
            ) : null}
          </div>
          {showComments ? (
            <div
              className="mt-3 space-y-2 border-t border-[var(--stroke)] pt-3"
              data-testid={`comments-${card.id}`}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                Comments
              </p>
              {comments.length === 0 ? (
                <p className="text-[11px] text-[var(--gray-text)]">No comments yet.</p>
              ) : (
                <ul className="space-y-2">
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="rounded-lg border border-[var(--stroke)] bg-white px-2 py-1.5"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-[10px]">
                        <span className="font-semibold text-[var(--primary-blue)]">
                          @{comment.author}
                        </span>
                        {currentUser === comment.author ? (
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
                      <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-[var(--navy-dark)]">
                        {parseMentions(comment.body).map((segment, index) =>
                          segment.kind === "mention" ? (
                            <span
                              key={`m-${index}`}
                              className="rounded bg-[var(--primary-blue)]/15 px-1 font-semibold text-[var(--primary-blue)]"
                              data-testid="mention"
                            >
                              @{segment.username}
                            </span>
                          ) : (
                            <span key={`t-${index}`}>{segment.value}</span>
                          )
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {currentUser ? (
                <form onSubmit={handleAddComment} className="flex items-start gap-1">
                  <textarea
                    value={newCommentBody}
                    onChange={(event) => setNewCommentBody(event.target.value)}
                    rows={2}
                    placeholder="Add a comment…"
                    className="flex-1 resize-none rounded-lg border border-[var(--stroke)] px-2 py-1 text-[12px] text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                    aria-label={`Add a comment to ${card.title}`}
                  />
                  {newCommentBody.trim() ? (
                    <button
                      type="submit"
                      className="rounded-md bg-[var(--secondary-purple)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
                    >
                      Post
                    </button>
                  ) : null}
                </form>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </article>
  );
};
