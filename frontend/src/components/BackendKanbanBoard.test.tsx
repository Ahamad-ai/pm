import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackendKanbanBoard } from "@/components/BackendKanbanBoard";
import { initialData } from "@/lib/kanban";

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

const createJsonResponse = (payload: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => payload,
  }) as Response;

describe("BackendKanbanBoard", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      if (url === "/api/board" && method === "GET") {
        return createJsonResponse({ username: "user", board: initialData });
      }
      if (url === "/api/board" && method === "PUT") {
        return createJsonResponse({ username: "user", board: initialData });
      }
      if (url === "/api/chat" && method === "POST") {
        return createJsonResponse({
          assistant_message: "Done. I added the card.",
          board_updated: true,
          board: boardWithAiCard,
        });
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ detail: "Unexpected request" }),
      } as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads board from backend", async () => {
    render(<BackendKanbanBoard />);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument()
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/board",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("persists board changes to backend", async () => {
    render(<BackendKanbanBoard />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument()
    );

    const firstColumn = screen.getAllByTestId(/column-/i)[0];
    const input = within(firstColumn).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed");

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/board",
        expect.objectContaining({ method: "PUT" })
      )
    );
  });

  it("sends chat and applies AI board update", async () => {
    render(<BackendKanbanBoard />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument()
    );

    await userEvent.type(screen.getByLabelText("Chat message"), "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText("Done. I added the card.")).toBeInTheDocument()
    );
    expect(screen.getByText("AI generated card")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" })
    );
  });
});
