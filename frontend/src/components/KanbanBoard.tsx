"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CardDetailModal } from "@/components/CardDetailModal";
import { CardFilterBar } from "@/components/CardFilterBar";
import { KanbanColumn, type ColumnAccent } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import type { NewCardInput } from "@/components/NewCardForm";
import {
  collectBoardAssignees,
  collectBoardLabels,
  columnIdFromHandle,
  createId,
  filteredCardIds,
  initialData,
  isColumnHandleId,
  moveCard,
  normalizeDropTargetId,
  type BoardData,
  type Card,
  type CardFilter,
} from "@/lib/kanban";

type KanbanBoardProps = {
  board?: BoardData;
  canEdit?: boolean;
  currentUser?: string;
  onBoardChange?: (board: BoardData) => void;
};

function AddColumnTile({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  return (
    <section
      className="flex min-h-[180px] flex-col items-stretch justify-start rounded-3xl border-2 border-dashed border-[var(--stroke)] bg-white/30 p-3"
      data-testid="add-column-tile"
    >
      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = draft.trim();
            if (!trimmed) return;
            onAdd(trimmed);
            setDraft("");
            setOpen(false);
          }}
          className="space-y-2"
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Column title"
            autoFocus
            maxLength={100}
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
            aria-label="New column title"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDraft("");
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-1 items-center justify-center rounded-2xl text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--navy-dark)]"
          data-testid="add-column-button"
        >
          + Add column
        </button>
      )}
    </section>
  );
}

const COLUMN_ACCENTS: ColumnAccent[] = [
  { dot: "#94a3b8", text: "text-slate-600", soft: "bg-slate-100" },
  { dot: "#209dd7", text: "text-[var(--primary-blue)]", soft: "bg-sky-50" },
  { dot: "#ecad0a", text: "text-[#a07000]", soft: "bg-amber-50" },
  { dot: "#753991", text: "text-[var(--secondary-purple)]", soft: "bg-purple-50" },
  { dot: "#16a34a", text: "text-emerald-600", soft: "bg-emerald-50" },
];

export function KanbanBoard({
  board: controlledBoard,
  canEdit = true,
  currentUser,
  onBoardChange,
}: KanbanBoardProps) {
  const [internalBoard, setInternalBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const [filter, setFilter] = useState<CardFilter>({});
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(
    () => new Set()
  );

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedCardIds(new Set());
  };

  const handleToggleSelect = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const bulkArchive = () => {
    setBoard((prev) => {
      const cards = { ...prev.cards };
      for (const id of selectedCardIds) {
        if (cards[id]) {
          cards[id] = { ...cards[id], archived: true };
        }
      }
      return { ...prev, cards };
    });
    exitSelectMode();
  };

  const bulkDelete = () => {
    if (
      !window.confirm(
        `Delete ${selectedCardIds.size} card${selectedCardIds.size === 1 ? "" : "s"}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBoard((prev) => {
      const cards = { ...prev.cards };
      for (const id of selectedCardIds) {
        delete cards[id];
      }
      const columns = prev.columns.map((column) => ({
        ...column,
        cardIds: column.cardIds.filter((id) => !selectedCardIds.has(id)),
      }));
      return { ...prev, cards, columns };
    });
    exitSelectMode();
  };

  const bulkMoveTo = (columnId: string) => {
    setBoard((prev) => {
      const target = prev.columns.find((column) => column.id === columnId);
      if (!target) return prev;
      const columns = prev.columns.map((column) => ({
        ...column,
        cardIds: column.cardIds.filter((id) => !selectedCardIds.has(id)),
      }));
      return {
        ...prev,
        columns: columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: [...column.cardIds, ...Array.from(selectedCardIds)],
              }
            : column
        ),
      };
    });
    exitSelectMode();
  };

  const bulkAssign = () => {
    const assignee = window.prompt("Assignee username (empty to clear):", "");
    if (assignee === null) return;
    const value = assignee.trim();
    setBoard((prev) => {
      const cards = { ...prev.cards };
      for (const id of selectedCardIds) {
        if (!cards[id]) continue;
        const next = { ...cards[id] };
        if (value) {
          next.assignee = value;
        } else {
          delete next.assignee;
        }
        cards[id] = next;
      }
      return { ...prev, cards };
    });
    exitSelectMode();
  };
  const board = controlledBoard ?? internalBoard;
  const matchedCardIds = useMemo(() => filteredCardIds(board, filter), [board, filter]);
  const availableLabels = useMemo(() => collectBoardLabels(board), [board]);
  const availableAssignees = useMemo(
    () => collectBoardAssignees(board),
    [board]
  );
  const totalCardCount = Object.keys(board.cards).length;
  const matchCount = matchedCardIds.size;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);
  const columnIdSet = useMemo(
    () => new Set(board.columns.map((column) => column.id)),
    [board.columns]
  );

  // closestCorners misses empty columns: neighboring columns' card corners can be
  // closer than the empty column's section corners, so the drop never resolves to
  // the empty column. pointer-within-first reliably picks the column the cursor is
  // actually inside, while still preferring card collisions for in-column reorder.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const pointerCollisions = pointerWithin(args);
      if (pointerCollisions.length > 0) {
        const cardCollisions = pointerCollisions.filter(
          (collision) => !columnIdSet.has(String(collision.id))
        );
        return cardCollisions.length > 0 ? cardCollisions : pointerCollisions;
      }
      return rectIntersection(args);
    },
    [columnIdSet]
  );

  const setBoard = (updater: (prev: BoardData) => BoardData) => {
    if (controlledBoard) {
      const nextBoard = updater(board);
      onBoardChange?.(nextBoard);
      return;
    }
    setInternalBoard((prev) => {
      const nextBoard = updater(prev);
      onBoardChange?.(nextBoard);
      return nextBoard;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (isColumnHandleId(id)) {
      setDragAnnouncement("Picked up column.");
      return;
    }
    setActiveCardId(id);
    const card = board.cards[id];
    if (card) {
      setDragAnnouncement(`Picked up card: ${card.title}`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = String(active.id);

    // Column reorder
    if (isColumnHandleId(activeId)) {
      if (over) {
        const fromColumnId = columnIdFromHandle(activeId);
        const overId = String(over.id);
        const toColumnId = columnIdFromHandle(overId);
        if (fromColumnId && toColumnId && fromColumnId !== toColumnId) {
          setBoard((prev) => {
            const fromIndex = prev.columns.findIndex(
              (column) => column.id === fromColumnId
            );
            const toIndex = prev.columns.findIndex(
              (column) => column.id === toColumnId
            );
            if (fromIndex === -1 || toIndex === -1) {
              return prev;
            }
            const next = [...prev.columns];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return { ...prev, columns: next };
          });
          setDragAnnouncement("Column reordered.");
          return;
        }
      }
      setDragAnnouncement("Column dropped in original position.");
      return;
    }

    setActiveCardId(null);

    if (!over || active.id === over.id) {
      setDragAnnouncement("Card dropped in original position.");
      return;
    }

    // The column section is BOTH a droppable (id=column.id) and a sortable
    // (id="col-handle:<column.id>"). When a card drops over it, dnd-kit may
    // resolve over.id to the sortable form — normalize back to the column id
    // so moveCard can route the drop to that column.
    const overId = normalizeDropTargetId(String(over.id));
    if (activeId === overId) {
      setDragAnnouncement("Card dropped in original position.");
      return;
    }
    setBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, activeId, overId),
    }));
    setDragAnnouncement("Card moved.");
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (columnId: string, input: NewCardInput) => {
    const id = createId("card");
    const newCard: Card = {
      id,
      title: input.title,
      details: input.details || "No details yet.",
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      ...(input.labels && input.labels.length > 0
        ? { labels: input.labels }
        : {}),
      createdAt: new Date().toISOString(),
    };
    setBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: newCard,
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const handleEditCard = (cardId: string, patch: Partial<Card>) => {
    setBoard((prev) => {
      const existing = prev.cards[cardId];
      if (!existing) {
        return prev;
      }
      const next: Card = { ...existing };
      const keys: (keyof Card)[] = [
        "title",
        "details",
        "priority",
        "dueDate",
        "labels",
        "assignee",
        "subtasks",
        "comments",
        "archived",
        "linkedCardIds",
        "attachments",
        "timeEntries",
      ];
      for (const key of keys) {
        if (key in patch) {
          const value = patch[key];
          if (key === "archived") {
            if (value) {
              next.archived = true;
            } else {
              delete next.archived;
            }
            continue;
          }
          if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
            delete next[key];
          } else {
            // @ts-expect-error narrowing across union of partial Card field types
            next[key] = value;
          }
        }
      }
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: next,
        },
      };
    });
  };

  const handleAddColumn = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBoard((prev) => ({
      ...prev,
      columns: [
        ...prev.columns,
        {
          id: createId("col"),
          title: trimmed,
          cardIds: [],
        },
      ],
    }));
  };

  const handleDeleteColumn = (columnId: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.filter((column) => column.id !== columnId),
    }));
  };

  const handleUpdateColumn = (
    columnId: string,
    patch: { wipLimit?: number | null }
  ) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) => {
        if (column.id !== columnId) return column;
        const next: typeof column = { ...column };
        if ("wipLimit" in patch) {
          if (patch.wipLimit === null || patch.wipLimit === undefined) {
            delete next.wipLimit;
          } else {
            next.wipLimit = patch.wipLimit;
          }
        }
        return next;
      }),
    }));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;
  const activeAccent = activeCardId
    ? (() => {
        const columnIndex = board.columns.findIndex((column) =>
          column.cardIds.includes(activeCardId)
        );
        return columnIndex >= 0
          ? COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length]
          : COLUMN_ACCENTS[0];
      })()
    : COLUMN_ACCENTS[0];

  return (
    <div className="relative">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {dragAnnouncement}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.22)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.16)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-7 px-3 pb-16 pt-4 sm:px-6 sm:pt-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-[var(--stroke)] bg-white/80 p-7 shadow-[var(--shadow-soft)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
            Single Board Kanban
          </p>
          <h1 className="font-display text-4xl font-semibold text-[var(--navy-dark)]">
            Kanban Studio
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--gray-text)]">
            Drag cards across stages, capture quick notes, and lean on the AI
            assistant when you need a hand.
          </p>
        </header>

        <CardFilterBar
          filter={filter}
          availableLabels={availableLabels}
          availableAssignees={availableAssignees}
          onChange={setFilter}
          matchCount={matchCount}
          totalCount={totalCardCount}
          savedViews={board.views}
          canEditViews={canEdit}
          onSaveView={(name, savedFilter) => {
            const next = [
              ...(board.views ?? []),
              { id: createId("v"), name, filter: savedFilter },
            ];
            setBoard((prev) => ({ ...prev, views: next }));
          }}
          onDeleteView={(id) => {
            setBoard((prev) => ({
              ...prev,
              views: (prev.views ?? []).filter((view) => view.id !== id),
            }));
          }}
        />
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--stroke)] bg-white/85 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {selectMode ? (
              <>
                <span className="text-[var(--navy-dark)]">
                  {selectedCardIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={bulkArchive}
                  disabled={selectedCardIds.size === 0}
                  className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[var(--navy-dark)] disabled:opacity-50 hover:border-[var(--primary-blue)]"
                  data-testid="bulk-archive"
                >
                  Archive
                </button>
                <select
                  value=""
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) bulkMoveTo(value);
                  }}
                  disabled={selectedCardIds.size === 0}
                  className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[var(--navy-dark)] disabled:opacity-50"
                  aria-label="Move selected cards to column"
                  data-testid="bulk-move"
                >
                  <option value="">Move to…</option>
                  {board.columns.map((column) => (
                    <option key={column.id} value={column.id}>
                      {column.title}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={bulkAssign}
                  disabled={selectedCardIds.size === 0}
                  className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[var(--navy-dark)] disabled:opacity-50 hover:border-[var(--primary-blue)]"
                  data-testid="bulk-assign"
                >
                  Assign…
                </button>
                <button
                  type="button"
                  onClick={bulkDelete}
                  disabled={selectedCardIds.size === 0}
                  className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[var(--secondary-purple)] disabled:opacity-50 hover:bg-[var(--secondary-purple)]/5"
                  data-testid="bulk-delete"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={exitSelectMode}
                  className="ml-auto rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[var(--gray-text)] hover:text-[var(--navy-dark)]"
                  data-testid="bulk-exit"
                >
                  Exit
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
                data-testid="bulk-select-toggle"
              >
                Bulk select
              </button>
            )}
          </div>
        ) : null}

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={board.columns.map((column) => `col-handle:${column.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <section
              className="scroll-thin grid gap-5 overflow-x-auto pb-2"
              style={{
                gridTemplateColumns: `repeat(${Math.max(
                  board.columns.length + (canEdit ? 1 : 0),
                  1
                )}, minmax(260px, 1fr))`,
              }}
            >
              {board.columns.map((column, index) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  accent={COLUMN_ACCENTS[index % COLUMN_ACCENTS.length]}
                  matchedCardIds={
                    matchCount === totalCardCount ? undefined : matchedCardIds
                  }
                  canEdit={canEdit}
                  currentUser={currentUser}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onEditCard={handleEditCard}
                  onUpdateColumn={handleUpdateColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onOpenCard={(cardId) => setOpenCardId(cardId)}
                  selectMode={selectMode}
                  selectedCardIds={selectedCardIds}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
              {canEdit ? (
                <AddColumnTile onAdd={handleAddColumn} />
              ) : null}
            </section>
          </SortableContext>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} accentColor={activeAccent.dot} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
      {openCardId && board.cards[openCardId] ? (
        <CardDetailModal
          key={openCardId}
          card={board.cards[openCardId]}
          allCards={board.cards}
          columnTitle={
            board.columns.find((column) => column.cardIds.includes(openCardId))
              ?.title
          }
          canEdit={canEdit}
          currentUser={currentUser}
          onChange={(patch) => handleEditCard(openCardId, patch)}
          onDelete={() => {
            const columnId = board.columns.find((column) =>
              column.cardIds.includes(openCardId)
            )?.id;
            if (columnId) {
              handleDeleteCard(columnId, openCardId);
            }
            setOpenCardId(null);
          }}
          onClose={() => setOpenCardId(null)}
          onJumpToCard={(cardId) => {
            if (board.cards[cardId]) {
              setOpenCardId(cardId);
            }
          }}
        />
      ) : null}
    </div>
  );
}
