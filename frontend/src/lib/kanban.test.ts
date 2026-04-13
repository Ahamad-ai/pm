import { createId, moveCard, type Column } from "@/lib/kanban";

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

describe("createId", () => {
  it("produces unique IDs with the given prefix", () => {
    const id1 = createId("card");
    const id2 = createId("card");
    expect(id1).toMatch(/^card-/);
    expect(id2).toMatch(/^card-/);
    expect(id1).not.toBe(id2);
  });
});
