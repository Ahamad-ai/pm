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
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { KanbanColumn, type ColumnAccent } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  board?: BoardData;
  onBoardChange?: (board: BoardData) => void;
};

const COLUMN_ACCENTS: ColumnAccent[] = [
  { dot: "#94a3b8", text: "text-slate-600", soft: "bg-slate-100" },
  { dot: "#209dd7", text: "text-[var(--primary-blue)]", soft: "bg-sky-50" },
  { dot: "#ecad0a", text: "text-[#a07000]", soft: "bg-amber-50" },
  { dot: "#753991", text: "text-[var(--secondary-purple)]", soft: "bg-purple-50" },
  { dot: "#16a34a", text: "text-emerald-600", soft: "bg-emerald-50" },
];

export const KanbanBoard = ({ board: controlledBoard, onBoardChange }: KanbanBoardProps) => {
  const [internalBoard, setInternalBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState("");
  const board = controlledBoard ?? internalBoard;

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
    setActiveCardId(id);
    const card = board.cards[id];
    if (card) {
      setDragAnnouncement(`Picked up card: ${card.title}`);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      setDragAnnouncement("Card dropped in original position.");
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
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

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet." },
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

  const handleEditCard = (cardId: string, title: string, details: string) => {
    setBoard((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: {
          ...prev.cards[cardId],
          title,
          details,
        },
      },
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
    <div className="relative overflow-hidden">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {dragAnnouncement}
      </div>
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.22)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.16)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-7 px-6 pb-16 pt-8">
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

        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <section className="grid gap-5 lg:grid-cols-5">
            {board.columns.map((column, index) => (
              <KanbanColumn
                key={column.id}
                column={column}
                cards={column.cardIds.map((cardId) => board.cards[cardId])}
                accent={COLUMN_ACCENTS[index % COLUMN_ACCENTS.length]}
                onRename={handleRenameColumn}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onEditCard={handleEditCard}
              />
            ))}
          </section>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} accentColor={activeAccent.dot} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
