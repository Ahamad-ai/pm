import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArchivedCardsPanel } from "@/components/ArchivedCardsPanel";
import type { BoardData } from "@/lib/kanban";

const board: BoardData = {
  columns: [
    { id: "c1", title: "Backlog", cardIds: ["a", "b"] },
    { id: "c2", title: "Done", cardIds: ["c"] },
  ],
  cards: {
    a: { id: "a", title: "Active card", details: "" },
    b: { id: "b", title: "Old card", details: "", archived: true },
    c: { id: "c", title: "Done card", details: "", archived: true },
  },
};

describe("ArchivedCardsPanel", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ArchivedCardsPanel
        board={board}
        isOpen={false}
        canEdit={true}
        onClose={() => undefined}
        onRestore={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("lists archived cards with their column", () => {
    render(
      <ArchivedCardsPanel
        board={board}
        isOpen={true}
        canEdit={true}
        onClose={() => undefined}
        onRestore={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(screen.getByTestId("archived-card-b")).toBeInTheDocument();
    expect(screen.getByTestId("archived-card-c")).toBeInTheDocument();
    expect(screen.queryByTestId("archived-card-a")).not.toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });

  it("calls onRestore when restoring", async () => {
    const onRestore = vi.fn();
    render(
      <ArchivedCardsPanel
        board={board}
        isOpen={true}
        canEdit={true}
        onClose={() => undefined}
        onRestore={onRestore}
        onDelete={() => undefined}
      />
    );
    await userEvent.click(screen.getByTestId("restore-b"));
    expect(onRestore).toHaveBeenCalledWith("b");
  });

  it("hides actions when not editable", () => {
    render(
      <ArchivedCardsPanel
        board={board}
        isOpen={true}
        canEdit={false}
        onClose={() => undefined}
        onRestore={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(screen.queryByTestId("restore-b")).not.toBeInTheDocument();
  });

  it("shows empty state when nothing is archived", () => {
    const empty: BoardData = {
      columns: [{ id: "c1", title: "T", cardIds: ["a"] }],
      cards: { a: { id: "a", title: "A", details: "" } },
    };
    render(
      <ArchivedCardsPanel
        board={empty}
        isOpen={true}
        canEdit={true}
        onClose={() => undefined}
        onRestore={() => undefined}
        onDelete={() => undefined}
      />
    );
    expect(screen.getByText(/nothing archived yet/i)).toBeInTheDocument();
  });
});
