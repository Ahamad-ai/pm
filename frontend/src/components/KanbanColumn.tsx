import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

export type ColumnAccent = {
  dot: string;
  text: string;
  soft: string;
};

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  accent: ColumnAccent;
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onEditCard: (cardId: string, title: string, details: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  accent,
  onRename,
  onAddCard,
  onDeleteCard,
  onEditCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[520px] flex-col rounded-3xl border bg-white/85 p-4 shadow-[var(--shadow-soft)] backdrop-blur transition-all",
        isOver
          ? "-translate-y-0.5 border-[var(--accent-yellow)] ring-2 ring-[var(--accent-yellow)]/40"
          : "border-[var(--stroke)]"
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="flex items-center gap-3 border-b border-[var(--stroke)] pb-3">
        <span
          className="block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: accent.dot }}
          aria-hidden="true"
        />
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          className="flex-1 bg-transparent font-display text-base font-semibold text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
        />
        <span
          className={clsx(
            "inline-flex h-6 min-w-[26px] items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
            accent.soft,
            accent.text
          )}
          aria-label={`${cards.length} cards`}
        >
          {cards.length}
        </span>
      </div>
      <div className="scroll-thin mt-3 flex flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              accentColor={accent.dot}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
              onEdit={onEditCard}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--stroke)] px-3 py-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Drop a card here
          </div>
        )}
      </div>
      <NewCardForm
        accentColor={accent.dot}
        onAdd={(title, details) => onAddCard(column.id, title, details)}
      />
    </section>
  );
};
