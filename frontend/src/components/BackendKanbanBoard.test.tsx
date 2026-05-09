import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackendKanbanBoard } from "@/components/BackendKanbanBoard";
import { initialData } from "@/lib/kanban";

const SUMMARY = { id: 7, name: "My Board", position: 0 };

const boardWithAiCard = {
  ...initialData,
  cards: {
    ...initialData.cards,
    "card-ai": { id: "card-ai", title: "AI generated card", details: "Created by AI." },
  },
  columns: initialData.columns.map((column, index) =>
    index === 0 ? { ...column, cardIds: [...column.cardIds, "card-ai"] } : column
  ),
};

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

describe("BackendKanbanBoard", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url === "/api/boards" && method === "GET") {
        return jsonResponse(200, { username: "user", boards: [SUMMARY] });
      }
      if (url === `/api/boards/${SUMMARY.id}` && method === "GET") {
        return jsonResponse(200, {
          username: "user",
          ...SUMMARY,
          board: initialData,
        });
      }
      if (url === `/api/boards/${SUMMARY.id}` && method === "PUT") {
        return jsonResponse(200, {
          username: "user",
          ...SUMMARY,
          board: initialData,
        });
      }
      if (url === "/api/boards" && method === "POST") {
        return jsonResponse(201, {
          username: "user",
          id: 99,
          name: "New",
          position: 1,
          board: { columns: [], cards: {} },
        });
      }
      if (url === "/api/templates" && method === "GET") {
        return jsonResponse(200, { templates: [] });
      }
      if (url === `/api/boards/${SUMMARY.id}/stats` && method === "GET") {
        return jsonResponse(200, {
          board_id: SUMMARY.id,
          total_cards: 8,
          total_columns: 5,
          by_priority: {},
          by_column: {},
          overdue_count: 0,
          with_due_date: 0,
          subtasks: { done: 0, total: 0 },
        });
      }
      if (url === "/api/chat" && method === "POST") {
        return jsonResponse(200, {
          assistant_message: "Done. I added the card.",
          board_updated: true,
          board: boardWithAiCard,
          board_id: SUMMARY.id,
        });
      }
      return jsonResponse(500, { detail: "Unexpected request" });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the user's boards and shows the active one", async () => {
    render(<BackendKanbanBoard username="user" displayName="User" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Kanban Studio" })
      ).toBeInTheDocument()
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/boards",
      expect.objectContaining({ method: "GET" })
    );
    await waitFor(() =>
      expect(
        screen.getByTestId("board-switcher-trigger")
      ).toHaveTextContent(/My Board/)
    );
  });

  it("persists column rename to the active board", async () => {
    render(<BackendKanbanBoard username="user" displayName="User" />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Kanban Studio" })
      ).toBeInTheDocument()
    );

    const firstColumn = screen.getAllByTestId(/column-/i)[0];
    const input = within(firstColumn).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed");

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/boards/${SUMMARY.id}`,
        expect.objectContaining({ method: "PUT" })
      )
    );
  });

  it("sends chat with the active board id and applies AI updates", async () => {
    render(<BackendKanbanBoard username="user" displayName="User" />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Kanban Studio" })
      ).toBeInTheDocument()
    );

    await userEvent.type(screen.getByLabelText("Chat message"), "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText("Done. I added the card.")).toBeInTheDocument()
    );
    expect(screen.getByText("AI generated card")).toBeInTheDocument();

    const chatCalls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => url === "/api/chat"
    );
    expect(chatCalls.length).toBeGreaterThan(0);
    const lastChatCall = chatCalls[chatCalls.length - 1];
    const body = JSON.parse(lastChatCall[1].body as string);
    expect(body.board_id).toBe(SUMMARY.id);
  });

  it("can create a new board through the switcher", async () => {
    render(<BackendKanbanBoard username="user" displayName="User" />);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Kanban Studio" })
      ).toBeInTheDocument()
    );

    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    await userEvent.click(screen.getByTestId("create-board-button"));
    await userEvent.type(
      screen.getByLabelText("New board name"),
      "Q3 plans"
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/boards",
        expect.objectContaining({ method: "POST" })
      )
    );
  });
});
