import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalSearch } from "@/components/GlobalSearch";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

const samplePayload = {
  query: "ship",
  boards: [{ id: 1, name: "Shipping plans", role: "owner" }],
  cards: [
    {
      board_id: 2,
      board_name: "Roadmap",
      column_title: "In Progress",
      card_id: "c1",
      title: "Ship release",
      snippet: "Final coordination",
      priority: "high",
      labels: [],
    },
  ],
};

describe("GlobalSearch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not search until the user has typed at least 2 characters", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, { query: "", boards: [], cards: [] })
    );
    render(<GlobalSearch username="alice" />);
    await userEvent.type(screen.getByTestId("global-search-input"), "s");
    // Allow the debounce timer to elapse before asserting.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("renders boards and cards from the API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, samplePayload)
    );
    render(<GlobalSearch username="alice" />);
    await userEvent.type(screen.getByTestId("global-search-input"), "ship");

    await waitFor(() =>
      expect(screen.getByTestId("search-board-1")).toBeInTheDocument()
    );
    expect(screen.getByTestId("search-card-c1")).toBeInTheDocument();
  });

  it("calls onJumpToBoard when a card result is selected", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, samplePayload)
    );
    const onJump = vi.fn();
    render(<GlobalSearch username="alice" onJumpToBoard={onJump} />);
    await userEvent.type(screen.getByTestId("global-search-input"), "ship");
    await screen.findByTestId("search-card-c1");
    await userEvent.click(screen.getByTestId("search-card-c1"));
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it("shows a friendly empty state when there are no matches", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, { query: "noth", boards: [], cards: [] })
    );
    render(<GlobalSearch username="alice" />);
    await userEvent.type(
      screen.getByTestId("global-search-input"),
      "nothing here"
    );
    await waitFor(() =>
      expect(
        screen.getByText(/no matches for/i)
      ).toBeInTheDocument()
    );
  });
});
