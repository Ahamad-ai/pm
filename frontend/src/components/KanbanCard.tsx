import { useState, type CSSProperties, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  accentColor: string;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, title: string, details: string) => void;
};

export const KanbanCard = ({ card, accentColor, onDelete, onEdit }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(card.title);
  const [detailsDraft, setDetailsDraft] = useState(card.details);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: isEditing });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: accentColor,
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      return;
    }
    const nextDetails = detailsDraft.trim() || "No details yet.";
    onEdit(card.id, nextTitle, nextDetails);
    setIsEditing(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-2xl border border-[var(--stroke)] border-l-[3px] bg-white px-4 py-3.5 shadow-[var(--shadow-card)]",
        "transition-shadow duration-150",
        !isDragging && !isEditing && "hover:shadow-[var(--shadow-card-hover)]",
        isDragging && "opacity-60 shadow-[var(--shadow-card-hover)]",
        !isEditing && !isDragging && "cursor-grab active:cursor-grabbing"
      )}
      {...(!isEditing ? attributes : {})}
      {...(!isEditing ? listeners : {})}
      data-testid={`card-${card.id}`}
    >
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
          <h4 className="pr-5 font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          <p className="mt-1.5 text-[13px] leading-6 text-[var(--gray-text)]">
            {card.details}
          </p>
          <div className="mt-3 flex items-center justify-end gap-1 opacity-60 transition group-hover:opacity-100">
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
              onClick={() => onDelete(card.id)}
              className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--secondary-purple)]/30 hover:bg-[var(--secondary-purple)]/5 hover:text-[var(--secondary-purple)]"
              aria-label={`Drop ${card.title}`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12l-1 14H7L6 7z" />
              </svg>
              Drop
            </button>
          </div>
        </>
      )}
    </article>
  );
};
