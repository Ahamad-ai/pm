"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import {
  isOverdue,
  PRIORITY_DOT,
  type BoardData,
  type Card,
} from "@/lib/kanban";

type CalendarViewProps = {
  board: BoardData;
};

const isoDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildMonthGrid = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // Sunday start
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

const monthLabel = (year: number, month: number): string =>
  new Date(year, month, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

export const CalendarView = ({ board }: CalendarViewProps) => {
  const today = new Date();
  const [cursor, setCursor] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  const cardsByDate = useMemo(() => {
    const map: Record<string, Card[]> = {};
    for (const card of Object.values(board.cards)) {
      if (card.archived || !card.dueDate) continue;
      if (!map[card.dueDate]) {
        map[card.dueDate] = [];
      }
      map[card.dueDate].push(card);
    }
    return map;
  }, [board.cards]);

  const undated = useMemo(
    () =>
      Object.values(board.cards).filter(
        (card) => !card.archived && !card.dueDate
      ),
    [board.cards]
  );

  const days = buildMonthGrid(cursor.year, cursor.month);
  const todayKey = isoDay(today);

  const goPrev = () => {
    setCursor((prev) => {
      const month = prev.month === 0 ? 11 : prev.month - 1;
      const year = prev.month === 0 ? prev.year - 1 : prev.year;
      return { year, month };
    });
  };
  const goNext = () => {
    setCursor((prev) => {
      const month = prev.month === 11 ? 0 : prev.month + 1;
      const year = prev.month === 11 ? prev.year + 1 : prev.year;
      return { year, month };
    });
  };
  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  return (
    <div data-testid="calendar-view">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white/85 px-4 py-3 shadow-[var(--shadow-soft)] backdrop-blur">
        <button
          type="button"
          onClick={goPrev}
          className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
          data-testid="calendar-prev"
        >
          ‹ Prev
        </button>
        <button
          type="button"
          onClick={goToday}
          className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
        >
          Today
        </button>
        <button
          type="button"
          onClick={goNext}
          className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
          data-testid="calendar-next"
        >
          Next ›
        </button>
        <h3 className="ml-auto font-display text-base font-semibold text-[var(--navy-dark)]">
          {monthLabel(cursor.year, cursor.month)}
        </h3>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="px-2 py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = isoDay(day);
          const inMonth = day.getMonth() === cursor.month;
          const cards = cardsByDate[key] ?? [];
          return (
            <div
              key={key}
              className={clsx(
                "min-h-[110px] rounded-xl border p-2",
                inMonth
                  ? "border-[var(--stroke)] bg-white/85"
                  : "border-transparent bg-[var(--surface-muted)]/40 text-[var(--gray-text)]",
                key === todayKey && "ring-2 ring-[var(--primary-blue)]/40"
              )}
              data-testid={`calendar-cell-${key}`}
            >
              <p className="text-[11px] font-semibold tabular-nums text-[var(--navy-dark)]">
                {day.getDate()}
              </p>
              <ul className="mt-1 space-y-0.5">
                {cards.map((card) => {
                  const overdue = isOverdue(card.dueDate);
                  const dot = card.priority
                    ? PRIORITY_DOT[card.priority]
                    : "var(--primary-blue)";
                  return (
                    <li
                      key={card.id}
                      className={clsx(
                        "truncate rounded px-1 py-0.5 text-[11px]",
                        overdue
                          ? "bg-[#fee2e2] text-[#b91c1c]"
                          : "bg-[var(--surface-muted)] text-[var(--navy-dark)]"
                      )}
                      data-testid={`calendar-card-${card.id}`}
                    >
                      <span
                        className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{ background: dot }}
                        aria-hidden="true"
                      />
                      {card.title}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {undated.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-[var(--stroke)] bg-white/85 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
            {undated.length} cards with no due date
          </summary>
          <ul className="mt-2 space-y-1 text-[12px] text-[var(--navy-dark)]">
            {undated.map((card) => (
              <li key={card.id} className="truncate">
                {card.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
};
