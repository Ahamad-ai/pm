import { render, screen, waitFor } from "@testing-library/react";
import { ActivityPanel } from "@/components/ActivityPanel";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

describe("ActivityPanel", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/boards/7/activity") {
        return jsonResponse(200, {
          board_id: 7,
          entries: [
            {
              id: 1,
              action: "board.created",
              details: { name: "Roadmap" },
              created_at: "2026-05-09T10:00:00Z",
              username: "alice",
            },
            {
              id: 2,
              action: "board.renamed",
              details: { from: "Old", to: "New" },
              created_at: "2026-05-09T10:05:00Z",
              username: "alice",
            },
          ],
        });
      }
      return jsonResponse(500, { detail: "Unexpected" });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not render when closed", () => {
    const { container } = render(
      <ActivityPanel
        username="alice"
        boardId={7}
        isOpen={false}
        onClose={() => undefined}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("loads and shows activity entries", async () => {
    render(
      <ActivityPanel
        username="alice"
        boardId={7}
        isOpen={true}
        onClose={() => undefined}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("Board created")).toBeInTheDocument()
    );
    expect(screen.getByText("Board renamed")).toBeInTheDocument();
    expect(screen.getByText("Old → New")).toBeInTheDocument();
  });

  it("shows empty state when no entries", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, { board_id: 7, entries: [] })
    );
    render(
      <ActivityPanel
        username="alice"
        boardId={7}
        isOpen={true}
        onClose={() => undefined}
      />
    );
    await waitFor(() =>
      expect(screen.getByText(/no activity yet/i)).toBeInTheDocument()
    );
  });

  it("shows error when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(404, { detail: "Board not found." })
    );
    render(
      <ActivityPanel
        username="alice"
        boardId={7}
        isOpen={true}
        onClose={() => undefined}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
  });
});
