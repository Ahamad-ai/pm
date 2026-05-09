import {
  collectBoardAssignees,
  collectBoardLabels,
  columnIdFromHandle,
  createId,
  extractMentions,
  filteredCardIds,
  formatDuration,
  isCardArchived,
  isColumnHandleId,
  isOverdue,
  matchesFilter,
  moveCard,
  normalizeDropTargetId,
  openTimeEntry,
  parseMentions,
  PRIORITY_DOT,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  subtaskProgress,
  totalTrackedSeconds,
  visibleCardIds,
  wipState,
  type BoardData,
  type Card,
  type Column,
} from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("returns columns unchanged when activeId does not exist", () => {
    const result = moveCard(baseColumns, "nonexistent", "card-1");
    expect(result).toEqual(baseColumns);
  });

  it("returns columns unchanged when overId does not exist", () => {
    const result = moveCard(baseColumns, "card-1", "nonexistent");
    expect(result).toEqual(baseColumns);
  });

  it("returns columns unchanged when activeId equals overId", () => {
    const result = moveCard(baseColumns, "card-1", "card-1");
    expect(result).toEqual(baseColumns);
  });

  it("handles moving a card within an empty-after-move column", () => {
    const columns: Column[] = [
      { id: "col-a", title: "A", cardIds: ["card-1"] },
      { id: "col-b", title: "B", cardIds: [] },
    ];
    const result = moveCard(columns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual([]);
    expect(result[1].cardIds).toEqual(["card-1"]);
  });
});

describe("column-handle drop normalization", () => {
  // Regression: dnd-kit may resolve over.id to either the column's droppable
  // id (e.g. "col-progress") or its sortable id ("col-handle:col-progress")
  // when a card drops on the column header. moveCard recognizes the former
  // but not the latter — strips need to happen at the boundary.
  it("strips the col-handle prefix on drop targets", () => {
    expect(normalizeDropTargetId("col-handle:col-progress")).toBe("col-progress");
    expect(normalizeDropTargetId("col-progress")).toBe("col-progress");
    expect(normalizeDropTargetId("card-1")).toBe("card-1");
  });

  it("identifies column-handle drag ids", () => {
    expect(isColumnHandleId("col-handle:col-progress")).toBe(true);
    expect(isColumnHandleId("col-progress")).toBe(false);
    expect(isColumnHandleId("card-1")).toBe(false);
  });

  it("extracts the column id from the handle id", () => {
    expect(columnIdFromHandle("col-handle:col-progress")).toBe("col-progress");
    expect(columnIdFromHandle("col-progress")).toBeNull();
  });

  it("moveCard accepts the normalized over-id and moves the card", () => {
    const columns: Column[] = [
      { id: "col-a", title: "A", cardIds: ["card-1"] },
      { id: "col-b", title: "B", cardIds: [] },
    ];
    const overId = normalizeDropTargetId("col-handle:col-b");
    const next = moveCard(columns, "card-1", overId);
    expect(next[0].cardIds).toEqual([]);
    expect(next[1].cardIds).toEqual(["card-1"]);
  });
});

describe("createId", () => {
  it("produces unique IDs with the given prefix", () => {
    const id1 = createId("card");
    const id2 = createId("card");
    expect(id1).toMatch(/^card-/);
    expect(id2).toMatch(/^card-/);
    expect(id1).not.toBe(id2);
  });
});

describe("priority constants", () => {
  it("orders priorities from highest to lowest", () => {
    expect(PRIORITY_ORDER).toEqual(["urgent", "high", "medium", "low"]);
  });

  it("has a label and dot color for every priority", () => {
    for (const value of PRIORITY_ORDER) {
      expect(PRIORITY_LABEL[value]).toBeTruthy();
      expect(PRIORITY_DOT[value]).toMatch(/^#/);
    }
  });
});

describe("matchesFilter", () => {
  const card: Card = {
    id: "c1",
    title: "Ship release notes",
    details: "Coordinate with marketing.",
    priority: "high",
    labels: ["docs", "release"],
    assignee: "alice",
    dueDate: "2000-01-01",
    subtasks: [{ id: "s1", title: "Draft", done: false }],
  };

  it("matches everything when filter is empty", () => {
    expect(matchesFilter(card, {})).toBe(true);
  });

  it("matches by text query in title, labels, and subtasks", () => {
    expect(matchesFilter(card, { query: "release" })).toBe(true);
    expect(matchesFilter(card, { query: "draft" })).toBe(true);
    expect(matchesFilter(card, { query: "alice" })).toBe(true);
    expect(matchesFilter(card, { query: "absent" })).toBe(false);
  });

  it("filters by priority", () => {
    expect(matchesFilter(card, { priorities: ["high"] })).toBe(true);
    expect(matchesFilter(card, { priorities: ["low"] })).toBe(false);
  });

  it("filters by assignee", () => {
    expect(matchesFilter(card, { assignees: ["alice"] })).toBe(true);
    expect(matchesFilter(card, { assignees: ["bob"] })).toBe(false);
  });

  it("filters by labels (any match)", () => {
    expect(matchesFilter(card, { labels: ["docs"] })).toBe(true);
    expect(matchesFilter(card, { labels: ["docs", "frontend"] })).toBe(true);
    expect(matchesFilter(card, { labels: ["frontend"] })).toBe(false);
  });

  it("filters by overdue only", () => {
    expect(matchesFilter(card, { overdueOnly: true })).toBe(true);
    expect(
      matchesFilter({ ...card, dueDate: "2999-01-01" }, { overdueOnly: true })
    ).toBe(false);
  });

  it("combines filters with AND semantics", () => {
    expect(
      matchesFilter(card, {
        priorities: ["high"],
        labels: ["frontend"],
      })
    ).toBe(false);
  });
});

describe("filteredCardIds / collect helpers", () => {
  const board: BoardData = {
    columns: [],
    cards: {
      a: { id: "a", title: "A", details: "", priority: "high", labels: ["api"] },
      b: { id: "b", title: "B", details: "", priority: "low", labels: ["api", "ux"] },
      c: { id: "c", title: "C", details: "", assignee: "alice" },
    },
  };

  it("returns every id when no filter is active", () => {
    expect(filteredCardIds(board, {}).size).toBe(3);
  });

  it("filters cards by priority", () => {
    expect(Array.from(filteredCardIds(board, { priorities: ["high"] }))).toEqual(["a"]);
  });

  it("collects unique labels and assignees from the board", () => {
    expect(collectBoardLabels(board)).toEqual(["api", "ux"]);
    expect(collectBoardAssignees(board)).toEqual(["alice"]);
  });
});

describe("archive helpers", () => {
  it("filters archived cards from a column's visible ids", () => {
    const column: Column = {
      id: "col",
      title: "T",
      cardIds: ["a", "b", "c"],
    };
    const cards: Record<string, Card> = {
      a: { id: "a", title: "A", details: "" },
      b: { id: "b", title: "B", details: "", archived: true },
      c: { id: "c", title: "C", details: "" },
    };
    expect(visibleCardIds(column, cards)).toEqual(["a", "c"]);
    expect(isCardArchived(cards.a)).toBe(false);
    expect(isCardArchived(cards.b)).toBe(true);
  });
});

describe("wipState", () => {
  const column: Column = {
    id: "col",
    title: "T",
    cardIds: ["x"],
    wipLimit: 3,
  };
  it("returns 'none' when no limit is set", () => {
    expect(wipState({ ...column, wipLimit: undefined }, 5)).toBe("none");
  });
  it("returns 'none' when below the limit", () => {
    expect(wipState(column, 2)).toBe("none");
  });
  it("returns 'near' when at the limit", () => {
    expect(wipState(column, 3)).toBe("near");
  });
  it("returns 'exceeded' when above the limit", () => {
    expect(wipState(column, 4)).toBe("exceeded");
  });
});

describe("parseMentions / extractMentions", () => {
  it("returns the original text when there are no mentions", () => {
    expect(parseMentions("Hello world")).toEqual([
      { kind: "text", value: "Hello world" },
    ]);
    expect(extractMentions("Hello world")).toEqual([]);
  });

  it("splits text and mentions", () => {
    const segments = parseMentions("Ping @alice, see @bob.smith.");
    expect(segments).toEqual([
      { kind: "text", value: "Ping " },
      { kind: "mention", username: "alice" },
      { kind: "text", value: ", see " },
      { kind: "mention", username: "bob.smith" },
      { kind: "text", value: "." },
    ]);
  });

  it("dedupes the username list", () => {
    expect(extractMentions("@alice @alice @bob")).toEqual(["alice", "bob"]);
  });

  it("handles a body that starts with a mention", () => {
    expect(parseMentions("@alice hi")).toEqual([
      { kind: "mention", username: "alice" },
      { kind: "text", value: " hi" },
    ]);
  });
});

describe("time tracking helpers", () => {
  it("sums seconds across closed entries", () => {
    expect(
      totalTrackedSeconds({
        id: "x",
        title: "x",
        details: "",
        timeEntries: [
          {
            id: "1",
            startedAt: "2026-01-01T00:00:00Z",
            endedAt: "2026-01-01T00:30:00Z",
            seconds: 1800,
          },
          {
            id: "2",
            startedAt: "2026-01-01T01:00:00Z",
            endedAt: "2026-01-01T02:00:00Z",
            seconds: 3600,
          },
        ],
      })
    ).toBe(5400);
  });

  it("falls back to startedAt/endedAt when seconds is missing", () => {
    expect(
      totalTrackedSeconds({
        id: "x",
        title: "x",
        details: "",
        timeEntries: [
          {
            id: "1",
            startedAt: "2026-01-01T00:00:00Z",
            endedAt: "2026-01-01T00:10:00Z",
          },
        ],
      })
    ).toBe(600);
  });

  it("includes the running session in the total", () => {
    const start = new Date(Date.now() - 5_000).toISOString();
    const total = totalTrackedSeconds({
      id: "x",
      title: "x",
      details: "",
      timeEntries: [{ id: "1", startedAt: start }],
    });
    expect(total).toBeGreaterThanOrEqual(4);
  });

  it("openTimeEntry returns the running entry", () => {
    expect(
      openTimeEntry({
        id: "x",
        title: "x",
        details: "",
        timeEntries: [
          {
            id: "1",
            startedAt: "2026-01-01T00:00:00Z",
            endedAt: "2026-01-01T00:30:00Z",
            seconds: 1800,
          },
          { id: "2", startedAt: "2026-01-01T01:00:00Z" },
        ],
      })
    ).toEqual({ id: "2", startedAt: "2026-01-01T01:00:00Z" });
  });

  it("formats durations as Xh Ym", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(3600 + 30 * 60)).toBe("1h 30m");
  });
});

describe("subtaskProgress", () => {
  it("returns null when there are no subtasks", () => {
    expect(subtaskProgress({ id: "x", title: "x", details: "" })).toBeNull();
  });

  it("returns done/total counts", () => {
    expect(
      subtaskProgress({
        id: "x",
        title: "x",
        details: "",
        subtasks: [
          { id: "1", title: "a", done: true },
          { id: "2", title: "b", done: false },
        ],
      })
    ).toEqual({ done: 1, total: 2 });
  });
});

describe("isOverdue", () => {
  it("returns false for missing or invalid dates", () => {
    expect(isOverdue(undefined)).toBe(false);
    expect(isOverdue("")).toBe(false);
    expect(isOverdue("not-a-date")).toBe(false);
  });

  it("returns true for past dates", () => {
    expect(isOverdue("2000-01-01")).toBe(true);
  });

  it("returns false for future dates", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const iso = future.toISOString().slice(0, 10);
    expect(isOverdue(iso)).toBe(false);
  });
});
