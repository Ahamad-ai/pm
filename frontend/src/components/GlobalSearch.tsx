"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  searchAll,
  type SearchBoardHit,
  type SearchCardHit,
} from "@/lib/boardApi";
import { PRIORITY_DOT, PRIORITY_LABEL } from "@/lib/kanban";

type GlobalSearchProps = {
  username: string;
  onJumpToBoard?: (boardId: number) => void;
};

export const GlobalSearch = ({
  username,
  onJumpToBoard,
}: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<SearchBoardHit[]>([]);
  const [cards, setCards] = useState<SearchCardHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setBoards([]);
      setCards([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const handle = window.setTimeout(async () => {
      try {
        const data = await searchAll(username, query.trim());
        if (!cancelled) {
          setBoards(data.boards);
          setCards(data.cards);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Search failed.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [username, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (boardId: number) => {
    onJumpToBoard?.(boardId);
    setOpen(false);
    setQuery("");
  };

  const showResults =
    open && (query.trim().length >= 2 || isLoading || error !== null);

  return (
    <div
      className="relative w-40 min-w-[140px] max-w-full sm:w-56 lg:w-64"
      ref={containerRef}
    >
      <input
        type="search"
        id="global-search-input"
        placeholder="Search boards & cards…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setOpen(true)}
        aria-label="Global search"
        className="w-full rounded-full border border-[var(--stroke)] bg-white px-3 py-1.5 text-[12px] text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
        data-testid="global-search-input"
      />
      {showResults ? (
        <div
          className="absolute right-0 z-50 mt-2 w-96 rounded-2xl border border-[var(--stroke)] bg-white p-3 shadow-[var(--shadow)]"
          role="listbox"
          data-testid="global-search-results"
        >
          {error ? (
            <p className="text-xs text-[var(--secondary-purple)]" role="alert">
              {error}
            </p>
          ) : isLoading ? (
            <p className="text-xs text-[var(--gray-text)]">Searching…</p>
          ) : boards.length === 0 && cards.length === 0 ? (
            <p className="text-xs text-[var(--gray-text)]">
              No matches for &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <>
              {boards.length > 0 ? (
                <section className="mb-2">
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                    Boards
                  </p>
                  <ul className="space-y-1">
                    {boards.map((board) => (
                      <li key={`b-${board.id}`}>
                        <button
                          type="button"
                          onClick={() => handleSelect(board.id)}
                          className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-[var(--navy-dark)] hover:bg-[var(--surface-muted)]"
                          data-testid={`search-board-${board.id}`}
                        >
                          {board.name}
                          {board.role && board.role !== "owner" ? (
                            <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-[var(--gray-text)]">
                              {board.role}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {cards.length > 0 ? (
                <section>
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                    Cards
                  </p>
                  <ul className="space-y-1">
                    {cards.map((card) => (
                      <li key={`${card.board_id}-${card.card_id}`}>
                        <button
                          type="button"
                          onClick={() => handleSelect(card.board_id)}
                          className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-muted)]"
                          data-testid={`search-card-${card.card_id}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-[var(--navy-dark)]">
                              {card.title}
                            </span>
                            {card.priority ? (
                              <span
                                className={clsx(
                                  "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.15em]"
                                )}
                                style={{
                                  background: `${PRIORITY_DOT[card.priority]}1f`,
                                  color: PRIORITY_DOT[card.priority],
                                }}
                              >
                                {PRIORITY_LABEL[card.priority]}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-[var(--gray-text)]">
                            {card.board_name}
                            {card.column_title
                              ? ` · ${card.column_title}`
                              : ""}
                          </p>
                          {card.snippet ? (
                            <p className="mt-0.5 truncate text-[11px] text-[var(--gray-text)]">
                              {card.snippet}
                            </p>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
