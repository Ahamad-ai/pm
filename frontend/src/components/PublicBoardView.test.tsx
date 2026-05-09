import { render, screen } from "@testing-library/react";
import { PublicBoardView } from "@/components/PublicBoardView";
import type { BoardData } from "@/lib/kanban";

const board: BoardData = {
  columns: [
    { id: "c1", title: "Backlog", cardIds: ["a", "b"] },
    { id: "c2", title: "Done", cardIds: ["c"] },
  ],
  cards: {
    a: {
      id: "a",
      title: "Visible card",
      details: "Important details",
      priority: "high",
      labels: ["public"],
    },
    b: {
      id: "b",
      title: "Archived card",
      details: "",
      archived: true,
    },
    c: { id: "c", title: "Done card", details: "" },
  },
};

describe("PublicBoardView", () => {
  it("renders the board name and cards", () => {
    render(
      <PublicBoardView
        name="Roadmap"
        owner="alice"
        updatedAt="2026-05-09"
        board={board}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Roadmap" })
    ).toBeInTheDocument();
    expect(screen.getByText(/by @alice/)).toBeInTheDocument();
    expect(screen.getByTestId("public-card-a")).toBeInTheDocument();
    expect(screen.getByTestId("public-card-c")).toBeInTheDocument();
  });

  it("hides archived cards", () => {
    render(
      <PublicBoardView
        name="Roadmap"
        owner="alice"
        board={board}
      />
    );
    expect(screen.queryByTestId("public-card-b")).not.toBeInTheDocument();
  });

  it("counts only active cards in the header summary", () => {
    render(<PublicBoardView name="Roadmap" board={board} />);
    expect(screen.getByText(/2 cards/)).toBeInTheDocument();
  });
});
