"use client";

import clsx from "clsx";
import {
  isCardArchived,
  isOverdue,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  subtaskProgress,
  visibleCardIds,
  type BoardData,
  type Card,
  type Column,
} from "@/lib/kanban";

type PublicBoardViewProps = {
  name: string;
  owner?: string | null;
  updatedAt?: string | null;
  board: BoardData;
};

const COLUMN_DOTS = ["#94a3b8", "#209dd7", "#ecad0a", "#753991", "#16a34a"];

const formatDate = (iso: string | undefined): string => {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const ReadOnlyCard = ({ card }: { card: Card }) => {
  const overdue = isOverdue(card.dueDate);
  const progress = subtaskProgress(card);
  return (
    <article
      className="rounded-2xl border border-[var(--stroke)] border-l-[3px] bg-white px-4 py-3.5 shadow-[var(--shadow-card)]"
      style={{
        borderLeftColor: card.priority
          ? PRIORITY_DOT[card.priority]
          : "var(--primary-blue)",
      }}
      data-testid={`public-card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)]">
          {card.title}
        </h4>
        {card.priority ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]"
            style={{
              background: `${PRIORITY_DOT[card.priority]}1f`,
              color: PRIORITY_DOT[card.priority],
            }}
          >
            {PRIORITY_LABEL[card.priority]}
          </span>
        ) : null}
      </div>
      {card.details ? (
        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-[var(--gray-text)]">
          {card.details}
        </p>
      ) : null}
      {progress ? (
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
          Checklist {progress.done}/{progress.total}
        </p>
      ) : null}
      {(card.labels && card.labels.length > 0) ||
      card.dueDate ||
      card.assignee ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
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
                "rounded-full px-2 py-0.5 font-semibold",
                overdue
                  ? "bg-[#fee2e2] text-[#b91c1c]"
                  : "bg-emerald-50 text-emerald-700"
              )}
            >
              {overdue ? "Overdue" : "Due"} {formatDate(card.dueDate)}
            </span>
          ) : null}
          {card.assignee ? (
            <span className="rounded-full bg-[var(--primary-blue)]/10 px-2 py-0.5 font-semibold text-[var(--primary-blue)]">
              @{card.assignee}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

const ReadOnlyColumn = ({
  column,
  cards,
  accent,
}: {
  column: Column;
  cards: Record<string, Card>;
  accent: string;
}) => {
  const visibleIds = visibleCardIds(column, cards);
  return (
    <section
      className="flex min-h-[420px] flex-col rounded-3xl border border-[var(--stroke)] bg-white/85 p-4 shadow-[var(--shadow-soft)] backdrop-blur"
      data-testid={`public-column-${column.id}`}
    >
      <div className="flex items-center gap-3 border-b border-[var(--stroke)] pb-3">
        <span
          className="block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <h3 className="flex-1 font-display text-base font-semibold text-[var(--navy-dark)]">
          {column.title}
        </h3>
        <span className="rounded-full bg-[var(--surface-muted)] px-2 text-[11px] font-semibold tabular-nums text-[var(--navy-dark)]">
          {visibleIds.length}
        </span>
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
        {visibleIds.length === 0 ? (
          <p className="text-center text-xs text-[var(--gray-text)]">
            Nothing here
          </p>
        ) : (
          visibleIds.map((id) => {
            const card = cards[id];
            if (!card || isCardArchived(card)) return null;
            return <ReadOnlyCard key={id} card={card} />;
          })
        )}
      </div>
    </section>
  );
};

export const PublicBoardView = ({
  name,
  owner,
  updatedAt,
  board,
}: PublicBoardViewProps) => {
  const totalActive = Object.values(board.cards).filter(
    (card) => !isCardArchived(card)
  ).length;

  return (
    <div className="min-h-screen bg-[var(--surface)]" data-testid="public-board-view">
      <header className="border-b border-[var(--stroke)] bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--navy-dark)]">
              <span className="font-display text-base font-semibold text-[var(--accent-yellow)]">
                K
              </span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Read-only share
              </p>
              <h1 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
                {name}
              </h1>
            </div>
          </div>
          <div className="text-right text-[11px] text-[var(--gray-text)]">
            {owner ? <p>by @{owner}</p> : null}
            <p>{totalActive} cards</p>
            {updatedAt ? <p>Updated {updatedAt}</p> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <section
          className="grid gap-5"
          style={{
            gridTemplateColumns: `repeat(${Math.max(
              board.columns.length,
              1
            )}, minmax(260px, 1fr))`,
          }}
        >
          {board.columns.map((column, index) => (
            <ReadOnlyColumn
              key={column.id}
              column={column}
              cards={board.cards}
              accent={COLUMN_DOTS[index % COLUMN_DOTS.length]}
            />
          ))}
        </section>
      </main>
    </div>
  );
};
