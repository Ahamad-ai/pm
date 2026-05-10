export type CardPriority = "low" | "medium" | "high" | "urgent";

export type SubTask = {
  id: string;
  title: string;
  done: boolean;
};

export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt?: string;
};

export type Attachment = {
  id: string;
  label: string;
  url: string;
};

export type TimeEntry = {
  id: string;
  startedAt: string;
  endedAt?: string;
  seconds?: number;
};

export type Card = {
  id: string;
  title: string;
  details: string;
  priority?: CardPriority;
  dueDate?: string;
  labels?: string[];
  assignee?: string;
  createdAt?: string;
  subtasks?: SubTask[];
  comments?: Comment[];
  archived?: boolean;
  linkedCardIds?: string[];
  attachments?: Attachment[];
  timeEntries?: TimeEntry[];
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
  wipLimit?: number;
};

export type SavedView = {
  id: string;
  name: string;
  filter: CardFilter;
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
  views?: SavedView[];
};

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    {
      id: "col-progress",
      title: "In Progress",
      cardIds: ["card-3", "card-4"],
    },
    { id: "col-review", title: "Review", cardIds: ["card-5"] },
    { id: "col-done", title: "Done", cardIds: ["card-6", "card-7"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-4": {
      id: "card-4",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-5": {
      id: "card-5",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-6": {
      id: "card-6",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-7": {
      id: "card-7",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
};

export const emptyBoard: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {},
};

function isColumnId(columns: Column[], id: string): boolean {
  return columns.some((column) => column.id === id);
}

function findColumnId(columns: Column[], id: string): string | undefined {
  if (isColumnId(columns, id)) {
    return id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
}

export function moveCard(
  columns: Column[],
  activeId: string,
  overId: string
): Column[] {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);

  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId);
  const overColumn = columns.find((column) => column.id === overColumnId);

  if (!activeColumn || !overColumn) {
    return columns;
  }

  const isOverColumn = isColumnId(columns, overId);

  if (activeColumnId === overColumnId) {
    if (isOverColumn) {
      const nextCardIds = activeColumn.cardIds.filter(
        (cardId) => cardId !== activeId
      );
      nextCardIds.push(activeId);
      return columns.map((column) =>
        column.id === activeColumnId
          ? { ...column, cardIds: nextCardIds }
          : column
      );
    }

    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    const newIndex = activeColumn.cardIds.indexOf(overId);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }

    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);

    return columns.map((column) =>
      column.id === activeColumnId
        ? { ...column, cardIds: nextCardIds }
        : column
    );
  }

  const activeIndex = activeColumn.cardIds.indexOf(activeId);
  if (activeIndex === -1) {
    return columns;
  }

  const nextActiveCardIds = [...activeColumn.cardIds];
  nextActiveCardIds.splice(activeIndex, 1);

  const nextOverCardIds = [...overColumn.cardIds];
  if (isOverColumn) {
    nextOverCardIds.push(activeId);
  } else {
    const overIndex = overColumn.cardIds.indexOf(overId);
    const insertIndex = overIndex === -1 ? nextOverCardIds.length : overIndex;
    nextOverCardIds.splice(insertIndex, 0, activeId);
  }

  return columns.map((column) => {
    if (column.id === activeColumnId) {
      return { ...column, cardIds: nextActiveCardIds };
    }
    if (column.id === overColumnId) {
      return { ...column, cardIds: nextOverCardIds };
    }
    return column;
  });
}

export function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

const COLUMN_HANDLE_PREFIX = "col-handle:";

/** A column section is both a droppable and a sortable; dnd-kit may resolve
 * over.id to either form. Normalize back to the column id. */
export function normalizeDropTargetId(id: string): string {
  return id.startsWith(COLUMN_HANDLE_PREFIX)
    ? id.slice(COLUMN_HANDLE_PREFIX.length)
    : id;
}

export function isColumnHandleId(id: string): boolean {
  return id.startsWith(COLUMN_HANDLE_PREFIX);
}

export function columnIdFromHandle(id: string): string | null {
  return id.startsWith(COLUMN_HANDLE_PREFIX)
    ? id.slice(COLUMN_HANDLE_PREFIX.length)
    : null;
}

export const PRIORITY_ORDER: CardPriority[] = [
  "urgent",
  "high",
  "medium",
  "low",
];

export const PRIORITY_LABEL: Record<CardPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PRIORITY_DOT: Record<CardPriority, string> = {
  urgent: "#dc2626",
  high: "#ecad0a",
  medium: "#209dd7",
  low: "#94a3b8",
};

export function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) {
    return false;
  }
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

export type CardFilter = {
  query?: string;
  priorities?: CardPriority[];
  assignees?: string[];
  labels?: string[];
  overdueOnly?: boolean;
};

function isFilterActive(filter: CardFilter): boolean {
  if (filter.query && filter.query.trim()) return true;
  if (filter.priorities && filter.priorities.length > 0) return true;
  if (filter.assignees && filter.assignees.length > 0) return true;
  if (filter.labels && filter.labels.length > 0) return true;
  if (filter.overdueOnly) return true;
  return false;
}

export function matchesFilter(card: Card, filter: CardFilter): boolean {
  if (!isFilterActive(filter)) {
    return true;
  }

  if (filter.query && filter.query.trim()) {
    const haystack = [
      card.title,
      card.details,
      card.assignee ?? "",
      ...(card.labels ?? []),
      ...(card.subtasks ?? []).map((subtask) => subtask.title),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(filter.query.trim().toLowerCase())) {
      return false;
    }
  }

  if (
    filter.priorities &&
    filter.priorities.length > 0 &&
    !(card.priority && filter.priorities.includes(card.priority))
  ) {
    return false;
  }

  if (
    filter.assignees &&
    filter.assignees.length > 0 &&
    !(card.assignee && filter.assignees.includes(card.assignee))
  ) {
    return false;
  }

  if (filter.labels && filter.labels.length > 0) {
    const cardLabels = card.labels ?? [];
    if (!filter.labels.some((label) => cardLabels.includes(label))) {
      return false;
    }
  }

  if (filter.overdueOnly && !isOverdue(card.dueDate)) {
    return false;
  }

  return true;
}

export function filteredCardIds(
  board: BoardData,
  filter: CardFilter
): Set<string> {
  if (!isFilterActive(filter)) {
    return new Set(Object.keys(board.cards));
  }
  const matching = new Set<string>();
  for (const [id, card] of Object.entries(board.cards)) {
    if (matchesFilter(card, filter)) {
      matching.add(id);
    }
  }
  return matching;
}

export function collectBoardLabels(board: BoardData): string[] {
  const labels = new Set<string>();
  for (const card of Object.values(board.cards)) {
    for (const label of card.labels ?? []) {
      labels.add(label);
    }
  }
  return Array.from(labels).sort();
}

export function collectBoardAssignees(board: BoardData): string[] {
  const assignees = new Set<string>();
  for (const card of Object.values(board.cards)) {
    if (card.assignee) {
      assignees.add(card.assignee);
    }
  }
  return Array.from(assignees).sort();
}

export function isCardArchived(card: Card): boolean {
  return card.archived === true;
}

export function visibleCardIds(
  column: Column,
  cards: Record<string, Card>
): string[] {
  return column.cardIds.filter((id) => {
    const card = cards[id];
    return card !== undefined && !isCardArchived(card);
  });
}

export function wipState(
  column: Column,
  visibleCount: number
): "none" | "near" | "exceeded" {
  const limit = column.wipLimit;
  if (!limit || limit <= 0) {
    return "none";
  }
  if (visibleCount > limit) {
    return "exceeded";
  }
  if (visibleCount === limit) {
    return "near";
  }
  return "none";
}

export type MentionSegment =
  | { kind: "text"; value: string }
  | { kind: "mention"; username: string };

// Username starts and ends in [A-Za-z0-9_], may contain `.`/`-`/`@` in the middle.
const MENTION_RE = /@([A-Za-z0-9_](?:[A-Za-z0-9_.\-@]*[A-Za-z0-9_])?)/g;

export function parseMentions(body: string): MentionSegment[] {
  if (!body) {
    return [];
  }
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ kind: "text", value: body.slice(lastIndex, start) });
    }
    segments.push({ kind: "mention", username: match[1] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ kind: "text", value: body.slice(lastIndex) });
  }
  return segments;
}

export function extractMentions(body: string): string[] {
  const seen = new Set<string>();
  for (const match of body.matchAll(MENTION_RE)) {
    seen.add(match[1]);
  }
  return Array.from(seen);
}

function secondsForEntry(entry: TimeEntry): number {
  if (entry.endedAt) {
    if (typeof entry.seconds === "number" && entry.seconds >= 0) {
      return entry.seconds;
    }
    const started = Date.parse(entry.startedAt);
    const ended = Date.parse(entry.endedAt);
    if (Number.isFinite(started) && Number.isFinite(ended) && ended > started) {
      return Math.floor((ended - started) / 1000);
    }
    return 0;
  }
  const started = Date.parse(entry.startedAt);
  if (!Number.isFinite(started)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

export function totalTrackedSeconds(card: Card): number {
  const entries = card.timeEntries ?? [];
  let total = 0;
  for (const entry of entries) {
    total += secondsForEntry(entry);
  }
  return total;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0m";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export function openTimeEntry(card: Card): TimeEntry | null {
  return (card.timeEntries ?? []).find((entry) => !entry.endedAt) ?? null;
}

export function subtaskProgress(
  card: Card
): { done: number; total: number } | null {
  const subtasks = card.subtasks ?? [];
  if (subtasks.length === 0) {
    return null;
  }
  return {
    done: subtasks.filter((subtask) => subtask.done).length,
    total: subtasks.length,
  };
}
