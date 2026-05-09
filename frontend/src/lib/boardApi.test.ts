import {
  addCollaborator,
  buildExportUrl,
  createBoard,
  createBoardFromTemplate,
  deleteBoardById,
  disableShareLink,
  duplicateBoard,
  enableShareLink,
  fetchActivity,
  fetchBoard,
  fetchBoardById,
  fetchBoardStats,
  fetchMyTasks,
  fetchNotifications,
  getShareLink,
  importBoard,
  listBoards,
  listCollaborators,
  listTemplates,
  pinBoard,
  unpinBoard,
  markAllNotificationsRead,
  markNotificationRead,
  removeCollaborator,
  saveBoard,
  searchAll,
  sendChat,
  updateBoardById,
} from "@/lib/boardApi";

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

describe("fetchBoard (legacy single-board)", () => {
  it("returns board data on success", async () => {
    mockFetch(200, { username: "user", board: VALID_BOARD });
    const board = await fetchBoard("user");
    expect(board).toEqual(VALID_BOARD);
  });

  it("throws on non-OK response", async () => {
    mockFetch(500, {});
    await expect(fetchBoard("user")).rejects.toThrow(/Board fetch failed/);
  });
});

describe("saveBoard (legacy single-board)", () => {
  it("returns saved board on success", async () => {
    mockFetch(200, { username: "user", board: VALID_BOARD });
    const board = await saveBoard("user", VALID_BOARD);
    expect(board).toEqual(VALID_BOARD);
  });

  it("throws on non-OK response", async () => {
    mockFetch(400, {});
    await expect(saveBoard("user", VALID_BOARD)).rejects.toThrow(/Board save failed/);
  });
});

describe("listBoards", () => {
  it("returns the boards array", async () => {
    mockFetch(200, {
      username: "user",
      boards: [
        { id: 1, name: "First", position: 0 },
        { id: 2, name: "Second", position: 1 },
      ],
    });
    const boards = await listBoards("user");
    expect(boards.map((b) => b.name)).toEqual(["First", "Second"]);
  });

  it("throws when the request fails", async () => {
    mockFetch(401, { detail: "Unauthorized" });
    await expect(listBoards("user")).rejects.toThrow(/Could not list boards/);
  });
});

describe("createBoard", () => {
  it("posts the new board name", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          username: "user",
          id: 11,
          name: "New",
          position: 0,
          board: VALID_BOARD,
        }),
      });
    });

    const result = await createBoard("user", "New", VALID_BOARD);
    expect(result.id).toBe(11);
    expect(calls[0].url).toBe("/api/boards");
    const body = JSON.parse((calls[0].init.body as string) ?? "{}");
    expect(body.name).toBe("New");
    expect(body.board).toEqual(VALID_BOARD);
  });
});

describe("fetchBoardById / updateBoardById / deleteBoardById", () => {
  it("fetches a board by id", async () => {
    mockFetch(200, {
      username: "user",
      id: 5,
      name: "Roadmap",
      position: 0,
      board: VALID_BOARD,
    });
    const detail = await fetchBoardById("user", 5);
    expect(detail.name).toBe("Roadmap");
  });

  it("updates name and board through the API", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          username: "user",
          id: 5,
          name: "New name",
          position: 0,
          board: VALID_BOARD,
        }),
      });
    });
    const result = await updateBoardById("user", 5, { name: "New name" });
    expect(result.name).toBe("New name");
    expect(calls[0].init.method).toBe("PUT");
  });

  it("propagates 404 deletes as errors", async () => {
    mockFetch(404, { detail: "Board not found." });
    await expect(deleteBoardById("user", 99)).rejects.toThrow(/Board delete failed/);
  });
});

describe("fetchActivity", () => {
  it("returns the activity entries", async () => {
    mockFetch(200, {
      board_id: 5,
      entries: [{ id: 1, action: "board.created", username: "user" }],
    });
    const entries = await fetchActivity("user", 5);
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("board.created");
  });
});

describe("collaborator API", () => {
  it("lists collaborators", async () => {
    mockFetch(200, {
      board_id: 1,
      collaborators: [{ username: "bob", role: "editor" }],
    });
    const collaborators = await listCollaborators("alice", 1);
    expect(collaborators).toHaveLength(1);
    expect(collaborators[0].username).toBe("bob");
  });

  it("adds a collaborator with the given role", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ username: "bob", role: "editor" }),
      });
    });
    await addCollaborator("alice", 1, "bob", "editor");
    const body = JSON.parse((calls[0].init.body as string) ?? "{}");
    expect(body.username).toBe("bob");
    expect(body.role).toBe("editor");
  });

  it("removes a collaborator", async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, method: init?.method ?? "GET" });
      return Promise.resolve({
        ok: true,
        status: 204,
        json: async () => ({}),
      });
    });
    await removeCollaborator("alice", 1, "bob");
    expect(calls[0]).toEqual({
      url: "/api/boards/1/collaborators/bob",
      method: "DELETE",
    });
  });
});

describe("stats and export", () => {
  it("fetches stats", async () => {
    mockFetch(200, {
      board_id: 1,
      total_cards: 3,
      total_columns: 2,
      by_priority: {},
      by_column: {},
      overdue_count: 0,
      with_due_date: 0,
      subtasks: { done: 0, total: 0 },
    });
    const stats = await fetchBoardStats("alice", 1);
    expect(stats.total_cards).toBe(3);
  });

  it("constructs the export URL", () => {
    expect(buildExportUrl(7)).toBe("/api/boards/7/export");
  });
});

describe("duplicate / import / my tasks", () => {
  it("duplicates a board with an optional name", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          username: "alice",
          id: 99,
          name: "Roadmap (copy)",
          position: 0,
          board: VALID_BOARD,
        }),
      });
    });
    await duplicateBoard("alice", 7, "Roadmap (copy)");
    const body = JSON.parse((calls[0].init.body as string) ?? "{}");
    expect(body.name).toBe("Roadmap (copy)");
    expect(calls[0].url).toBe("/api/boards/7/duplicate");
  });

  it("imports a board", async () => {
    mockFetch(201, {
      username: "alice",
      id: 5,
      name: "Imported",
      position: 0,
      board: VALID_BOARD,
    });
    const detail = await importBoard("alice", {
      name: "Imported",
      board: VALID_BOARD,
    });
    expect(detail.name).toBe("Imported");
  });

  it("fetches my tasks", async () => {
    mockFetch(200, {
      username: "alice",
      tasks: [
        {
          board_id: 1,
          board_name: "B",
          card_id: "c1",
          title: "T",
          details: "",
          labels: [],
          overdue: false,
          subtasks: [],
        },
      ],
    });
    const tasks = await fetchMyTasks("alice");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("T");
  });
});

describe("search and templates API", () => {
  it("URL-encodes the search query", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url) => {
      calls.push(String(url));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ query: "x y", boards: [], cards: [] }),
      });
    });
    await searchAll("alice", "x y&z");
    expect(calls[0]).toBe("/api/search?q=x%20y%26z");
  });

  it("lists templates", async () => {
    mockFetch(200, {
      templates: [
        {
          id: "kanban",
          name: "Kanban",
          description: "",
          default_board_name: "Kanban",
          columns: [],
        },
      ],
    });
    const result = await listTemplates("alice");
    expect(result.map((t) => t.id)).toEqual(["kanban"]);
  });

  it("creates a board from a template with a custom name", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, init });
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          username: "alice",
          id: 11,
          name: "Q3",
          position: 0,
          board: VALID_BOARD,
        }),
      });
    });
    await createBoardFromTemplate("alice", "scrum", "Q3");
    expect(calls[0].url).toBe("/api/boards/from-template/scrum");
    const body = JSON.parse((calls[0].init.body as string) ?? "{}");
    expect(body.name).toBe("Q3");
  });
});

describe("pin / unpin boards", () => {
  it("calls POST to pin", async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, method: init?.method ?? "GET" });
      return Promise.resolve({
        ok: true,
        status: 204,
        json: async () => ({}),
      });
    });
    await pinBoard("alice", 7);
    expect(calls[0]).toEqual({ url: "/api/boards/7/pin", method: "POST" });
  });

  it("calls DELETE to unpin and tolerates 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: "Not pinned." }),
    });
    await expect(unpinBoard("alice", 7)).resolves.toBeUndefined();
  });
});

describe("notifications + share API", () => {
  it("fetches notifications", async () => {
    mockFetch(200, {
      username: "alice",
      unread_count: 0,
      notifications: [],
    });
    const data = await fetchNotifications("alice");
    expect(data.unread_count).toBe(0);
  });

  it("uses only_unread=true query when requested", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn().mockImplementation((url) => {
      calls.push(String(url));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          username: "alice",
          unread_count: 0,
          notifications: [],
        }),
      });
    });
    await fetchNotifications("alice", true);
    expect(calls[0]).toContain("only_unread=true");
  });

  it("marks one notification read and returns the new unread count", async () => {
    mockFetch(200, { unread_count: 3 });
    const remaining = await markNotificationRead("alice", 99);
    expect(remaining).toBe(3);
  });

  it("calls the read-all endpoint", async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, method: init?.method ?? "GET" });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ marked: 5, unread_count: 0 }),
      });
    });
    await markAllNotificationsRead("alice");
    expect(calls[0]).toEqual({
      url: "/api/users/me/notifications/read-all",
      method: "POST",
    });
  });

  it("manages the public share link via three endpoints", async () => {
    const calls: { url: string; method: string }[] = [];
    global.fetch = vi.fn().mockImplementation((url, init) => {
      calls.push({ url, method: init?.method ?? "GET" });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ board_id: 7, token: "abc", url: "/share/abc" }),
      });
    });
    await getShareLink("alice", 7);
    await enableShareLink("alice", 7);
    await disableShareLink("alice", 7);
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST", "DELETE"]);
  });
});

describe("sendChat", () => {
  it("returns chat response on success", async () => {
    const chatResponse = {
      assistant_message: "Done",
      board_updated: true,
      board: VALID_BOARD,
      board_id: 5,
    };
    mockFetch(200, chatResponse);
    const result = await sendChat("user", "hello", [], 5);
    expect(result.assistant_message).toBe("Done");
    expect(result.board_id).toBe(5);
  });

  it("throws with detail from error response", async () => {
    mockFetch(502, { detail: "OpenRouter down" });
    await expect(sendChat("user", "hello", [])).rejects.toThrow(/OpenRouter down/);
  });

  it("throws generic message when error response has no detail", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(sendChat("user", "hello", [])).rejects.toThrow(/Chat request failed/);
  });
});
