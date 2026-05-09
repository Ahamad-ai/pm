import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarView } from "@/components/CalendarView";
import type { BoardData } from "@/lib/kanban";

const today = new Date();
const todayKey = today.toISOString().slice(0, 10);

const futureKey = (() => {
  const d = new Date(today);
  d.setDate(today.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const board: BoardData = {
  columns: [
    { id: "c1", title: "Todo", cardIds: ["a", "b", "c", "d"] },
  ],
  cards: {
    a: { id: "a", title: "Today task", details: "", dueDate: todayKey },
    b: {
      id: "b",
      title: "Tomorrow task",
      details: "",
      dueDate: futureKey,
      priority: "high",
    },
    c: { id: "c", title: "No due", details: "" },
    d: {
      id: "d",
      title: "Archived task",
      details: "",
      dueDate: todayKey,
      archived: true,
    },
  },
};

describe("CalendarView", () => {
  it("renders cards in their due-date cell and excludes archived", () => {
    render(<CalendarView board={board} />);
    expect(screen.getByTestId("calendar-card-a")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-card-b")).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-card-d")).not.toBeInTheDocument();
  });

  it("collapses cards with no due date into a summary", () => {
    render(<CalendarView board={board} />);
    expect(screen.getByText(/1 cards with no due date/i)).toBeInTheDocument();
  });

  it("can navigate to next month and back", async () => {
    render(<CalendarView board={board} />);
    const startLabel = screen
      .getByText(/[A-Z][a-z]+ \d{4}/)
      .textContent;
    await userEvent.click(screen.getByTestId("calendar-next"));
    const afterNext = screen
      .getByText(/[A-Z][a-z]+ \d{4}/)
      .textContent;
    expect(afterNext).not.toBe(startLabel);
    await userEvent.click(screen.getByTestId("calendar-prev"));
    expect(screen.getByText(startLabel as string)).toBeInTheDocument();
  });
});
