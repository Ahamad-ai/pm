import {
  clearRecentBoards,
  getRecentBoardIds,
  recordRecentBoard,
} from "@/lib/recentBoards";

describe("recentBoards", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty array for a new user", () => {
    expect(getRecentBoardIds("alice")).toEqual([]);
  });

  it("records visits with most-recent first and dedupes", () => {
    recordRecentBoard("alice", 1);
    recordRecentBoard("alice", 2);
    recordRecentBoard("alice", 3);
    recordRecentBoard("alice", 1);
    expect(getRecentBoardIds("alice")).toEqual([1, 3, 2]);
  });

  it("caps the list at 5 entries", () => {
    [1, 2, 3, 4, 5, 6, 7].forEach((id) => recordRecentBoard("alice", id));
    expect(getRecentBoardIds("alice")).toHaveLength(5);
    expect(getRecentBoardIds("alice")[0]).toBe(7);
  });

  it("scopes per username", () => {
    recordRecentBoard("alice", 1);
    recordRecentBoard("bob", 99);
    expect(getRecentBoardIds("alice")).toEqual([1]);
    expect(getRecentBoardIds("bob")).toEqual([99]);
  });

  it("returns empty when storage holds invalid JSON", () => {
    localStorage.setItem("pm-recent-boards:alice", "not-json");
    expect(getRecentBoardIds("alice")).toEqual([]);
  });

  it("clears recents", () => {
    recordRecentBoard("alice", 1);
    clearRecentBoards("alice");
    expect(getRecentBoardIds("alice")).toEqual([]);
  });
});
