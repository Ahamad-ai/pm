import clsx from "clsx";
import { useState, type CSSProperties } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { isCardArchived, wipState, type Card, type Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm, type NewCardInput } from "@/components/NewCardForm";

export type ColumnAccent = {
  dot: string;
  text: string;
  soft: string;
};

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  accent: ColumnAccent;
  matchedCardIds?: Set<string>;
  canEdit?: boolean;
  currentUser?: string;
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, input: NewCardInput) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onEditCard: (cardId: string, patch: Partial<Card>) => void;
  onUpdateColumn?: (columnId: string, patch: { wipLimit?: number | null }) => void;
  onDeleteColumn?: (columnId: string) => void;
  onOpenCard?: (cardId: string) => void;
  selectMode?: boolean;
  selectedCardIds?: Set<string>;
  onToggleSelect?: (cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  accent,
  matchedCardIds,
  canEdit = true,
  currentUser,
  onRename,
  onAddCard,
  onDeleteCard,
  onEditCard,
  onUpdateColumn,
  onDeleteColumn,
  onOpenCard,
  selectMode,
  selectedCardIds,
  onToggleSelect,
}: KanbanColumnProps) => {
  const [showWipEditor, setShowWipEditor] = useState(false);
  const [wipDraft, setWipDraft] = useState<string>(
    column.wipLimit ? String(column.wipLimit) : ""
  );
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
  });

  const {
    attributes: handleAttributes,
    listeners: handleListeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `col-handle:${column.id}`,
    disabled: !canEdit,
  });

  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setSortableRef(node);
  };

  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const visibleCards = cards.filter((card) => !isCardArchived(card));
  const matchCount = matchedCardIds
    ? visibleCards.filter((card) => matchedCardIds.has(card.id)).length
    : visibleCards.length;
  const wip = wipState(column, visibleCards.length);

  const handleSaveWip = () => {
    const trimmed = wipDraft.trim();
    if (trimmed === "") {
      onUpdateColumn?.(column.id, { wipLimit: null });
    } else {
      const parsed = Number.parseInt(trimmed, 10);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
        onUpdateColumn?.(column.id, { wipLimit: parsed });
      }
    }
    setShowWipEditor(false);
  };

  const isEmpty = column.cardIds.length === 0;
  const canDelete = canEdit && Boolean(onDeleteColumn) && isEmpty;

  return (
    <section
      ref={setNodeRef}
      style={sortableStyle}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-3xl border bg-white/85 p-4 shadow-[var(--shadow-soft)] backdrop-blur transition-all",
        isOver
          ? "-translate-y-0.5 border-[var(--accent-yellow)] ring-2 ring-[var(--accent-yellow)]/40"
          : "border-[var(--stroke)]",
        isDragging && "opacity-50"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex flex-nowrap items-center gap-1.5 border-b border-[var(--stroke)] pb-3">
        {canEdit ? (
          <button
            type="button"
            {...handleAttributes}
            {...handleListeners}
            className="shrink-0 cursor-grab rounded-md p-1 text-[var(--gray-text)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--navy-dark)] active:cursor-grabbing"
            aria-label={`Reorder ${column.title} column`}
            data-testid={`column-drag-${column.id}`}
            title="Drag to reorder"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>
        ) : null}
        <span
          className="block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: accent.dot }}
          aria-hidden="true"
        />
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          className="min-w-0 flex-1 bg-transparent font-display text-base font-semibold text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
          readOnly={!canEdit}
        />
        <span
          className={clsx(
            "inline-flex h-6 min-w-[36px] shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
            wip === "exceeded"
              ? "bg-[#fee2e2] text-[#b91c1c]"
              : wip === "near"
              ? "bg-[var(--accent-yellow)]/15 text-[#a07000]"
              : `${accent.soft} ${accent.text}`
          )}
          aria-label={
            column.wipLimit
              ? `${visibleCards.length} of ${column.wipLimit} cards (WIP limit)`
              : `${visibleCards.length} cards`
          }
          data-testid={`column-count-${column.id}`}
        >
          {column.wipLimit
            ? `${visibleCards.length}/${column.wipLimit}`
            : matchedCardIds
            ? `${matchCount}/${visibleCards.length}`
            : visibleCards.length}
        </span>
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setWipDraft(column.wipLimit ? String(column.wipLimit) : "");
              setShowWipEditor((value) => !value);
            }}
            className="shrink-0 rounded-md p-1 text-[var(--gray-text)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--navy-dark)]"
            aria-label={`Edit WIP limit for ${column.title}`}
            title="Edit WIP limit"
            data-testid={`edit-wip-${column.id}`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25z" />
            </svg>
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            onClick={() => onDeleteColumn?.(column.id)}
            className="shrink-0 rounded-md p-1 text-[var(--gray-text)] transition hover:bg-[var(--secondary-purple)]/10 hover:text-[var(--secondary-purple)]"
            aria-label={`Delete ${column.title} column`}
            title="Delete empty column"
            data-testid={`delete-column-${column.id}`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
              <path d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM6 7h12l-1 14H7L6 7z" />
            </svg>
          </button>
        ) : null}
      </div>
      {showWipEditor ? (
        <div className="mt-2 flex items-center gap-1 rounded-lg border border-[var(--stroke)] bg-white px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
            WIP
          </span>
          <input
            value={wipDraft}
            onChange={(event) => setWipDraft(event.target.value)}
            type="number"
            min={1}
            max={100}
            placeholder="—"
            className="w-14 rounded border border-[var(--stroke)] px-1 py-0.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label={`WIP limit for ${column.title}`}
          />
          <button
            type="button"
            onClick={handleSaveWip}
            className="rounded bg-[var(--secondary-purple)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowWipEditor(false)}
            className="rounded border border-[var(--stroke)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
          >
            Cancel
          </button>
        </div>
      ) : null}
      <div className="scroll-thin mt-3 flex flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        <SortableContext
          items={visibleCards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleCards.map((card) => {
            const dim = matchedCardIds && !matchedCardIds.has(card.id);
            return (
              <div
                key={card.id}
                className={clsx(dim && "opacity-30 transition-opacity")}
                aria-hidden={dim || undefined}
                data-testid={dim ? `dimmed-${card.id}` : undefined}
              >
                <KanbanCard
                  card={card}
                  accentColor={accent.dot}
                  canEdit={canEdit}
                  currentUser={currentUser}
                  selectMode={selectMode}
                  isSelected={selectedCardIds?.has(card.id)}
                  onDelete={(cardId) => onDeleteCard(column.id, cardId)}
                  onEdit={onEditCard}
                  onOpen={onOpenCard}
                  onToggleSelect={onToggleSelect}
                />
              </div>
            );
          })}
        </SortableContext>
        {visibleCards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      {canEdit ? (
        <NewCardForm
          accentColor={accent.dot}
          onAdd={(input) => onAddCard(column.id, input)}
        />
      ) : null}
    </section>
  );
};
