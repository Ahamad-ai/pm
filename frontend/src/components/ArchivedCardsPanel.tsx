"use client";

import type { BoardData, Card } from "@/lib/kanban";

type ArchivedCardsPanelProps = {
  board: BoardData;
  isOpen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onRestore: (cardId: string) => void;
  onDelete: (cardId: string) => void;
};

function findCardColumn(
  board: BoardData,
  cardId: string
): string | undefined {
  return board.columns.find((column) => column.cardIds.includes(cardId))?.title;
}

export function ArchivedCardsPanel({
  board,
  isOpen,
  canEdit,
  onClose,
  onRestore,
  onDelete,
}: ArchivedCardsPanelProps) {
  if (!isOpen) {
    return null;
  }

  const archived: Card[] = Object.values(board.cards).filter(
    (card) => card.archived === true
  );

  return (
    <aside
      className="fixed left-5 top-16 z-30 w-80 rounded-2xl border border-[var(--stroke)] bg-white p-4 shadow-[var(--shadow)]"
      aria-label="Archived cards"
      data-testid="archived-panel"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]">
          Archived cards
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--stroke)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
          aria-label="Close archived panel"
        >
          Close
        </button>
      </div>
      {archived.length === 0 ? (
        <p className="text-xs text-[var(--gray-text)]">
          Nothing archived yet.
        </p>
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {archived.map((card) => (
            <li
              key={card.id}
              className="rounded-xl border border-[var(--stroke)] px-3 py-2"
              data-testid={`archived-card-${card.id}`}
            >
              <p className="text-sm font-semibold text-[var(--navy-dark)]">
                {card.title}
              </p>
              <p className="text-[10px] text-[var(--gray-text)]">
                {findCardColumn(board, card.id) ?? "—"}
              </p>
              {canEdit ? (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRestore(card.id)}
                    className="rounded-full bg-[var(--secondary-purple)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"
                    data-testid={`restore-${card.id}`}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(card.id)}
                    className="rounded-full border border-[var(--stroke)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
                    data-testid={`delete-archived-${card.id}`}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
