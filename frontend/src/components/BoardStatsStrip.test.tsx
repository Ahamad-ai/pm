import { render, screen, waitFor } from "@testing-library/react";
import { BoardStatsStrip } from "@/components/BoardStatsStrip";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

describe("BoardStatsStrip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when boardId is null", () => {
    const { container } = render(
      <BoardStatsStrip username="alice" boardId={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("loads and shows stats", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, {
        board_id: 1,
        total_cards: 5,
        total_columns: 3,
        by_priority: { high: 2, low: 1 },
        by_column: { Todo: 3, Done: 2 },
        overdue_count: 1,
        with_due_date: 2,
        subtasks: { done: 1, total: 4 },
      })
    );
    render(<BoardStatsStrip username="alice" boardId={1} />);

    await waitFor(() =>
      expect(screen.getByTestId("board-stats-strip")).toBeInTheDocument()
    );
    expect(screen.getByText("5")).toBeInTheDocument(); // total cards
    expect(screen.getByText("1/4")).toBeInTheDocument(); // subtasks
    expect(screen.getByText(/High · 2/)).toBeInTheDocument();
  });

  it("hides itself when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(404, { detail: "Board not found." })
    );
    const { container } = render(
      <BoardStatsStrip username="alice" boardId={1} />
    );
    await waitFor(() => {
      expect(container.querySelector("[data-testid='board-stats-strip']")).toBeNull();
    });
  });
});
