import { fetchBoard, saveBoard, sendChat } from "@/lib/boardApi";

const VALID_BOARD = {
  columns: [{ id: "col-a", title: "Backlog", cardIds: ["card-1"] }],
  cards: { "card-1": { id: "card-1", title: "Task", details: "Do this" } },
};

const mockFetch = (status: number, body: unknown) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchBoard", () => {
  it("returns board data on success", async () => {
    mockFetch(200, { username: "user", board: VALID_BOARD });
    const board = await fetchBoard("user");
    expect(board).toEqual(VALID_BOARD);
  });

  it("throws on non-OK response", async () => {
    mockFetch(500, {});
    await expect(fetchBoard("user")).rejects.toThrow("Board fetch failed with 500");
  });
});

describe("saveBoard", () => {
  it("returns saved board on success", async () => {
    mockFetch(200, { username: "user", board: VALID_BOARD });
    const board = await saveBoard("user", VALID_BOARD);
    expect(board).toEqual(VALID_BOARD);
  });

  it("throws on non-OK response", async () => {
    mockFetch(400, {});
    await expect(saveBoard("user", VALID_BOARD)).rejects.toThrow(
      "Board save failed with 400"
    );
  });
});

describe("sendChat", () => {
  it("returns chat response on success", async () => {
    const chatResponse = {
      assistant_message: "Done",
      board_updated: true,
      board: VALID_BOARD,
    };
    mockFetch(200, chatResponse);
    const result = await sendChat("user", "hello", []);
    expect(result.assistant_message).toBe("Done");
  });

  it("throws with detail from error response", async () => {
    mockFetch(502, { detail: "OpenRouter down" });
    await expect(sendChat("user", "hello", [])).rejects.toThrow(
      "Chat request failed with 502: OpenRouter down"
    );
  });

  it("throws generic message when error response has no detail", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(sendChat("user", "hello", [])).rejects.toThrow(
      "Chat request failed with 500"
    );
  });
});
