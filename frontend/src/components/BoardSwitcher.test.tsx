import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardSwitcher } from "@/components/BoardSwitcher";

const BOARDS = [
  { id: 1, name: "Roadmap", position: 0 },
  { id: 2, name: "Bugs", position: 1 },
];

describe("BoardSwitcher", () => {
  it("shows the active board name on the trigger", () => {
    render(
      <BoardSwitcher
        boards={BOARDS}
        activeBoardId={2}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByTestId("board-switcher-trigger")).toHaveTextContent("Bugs");
  });

  it("opens the menu and lets the user pick a different board", async () => {
    const onSelect = vi.fn();
    render(
      <BoardSwitcher
        boards={BOARDS}
        activeBoardId={2}
        onSelect={onSelect}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    await userEvent.click(screen.getByTestId("board-option-1"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("calls onCreate when the user submits a name", async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    render(
      <BoardSwitcher
        boards={BOARDS}
        activeBoardId={1}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    await userEvent.click(screen.getByTestId("create-board-button"));
    await userEvent.type(screen.getByLabelText("New board name"), "Q4 plan");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Q4 plan"));
  });

  it("creates from a template when one is selected", async () => {
    const onCreate = vi.fn(() => Promise.resolve());
    const onCreateFromTemplate = vi.fn(() => Promise.resolve());
    render(
      <BoardSwitcher
        boards={BOARDS}
        activeBoardId={1}
        templates={[
          {
            id: "scrum",
            name: "Scrum",
            description: "",
            default_board_name: "Scrum",
            columns: [],
          },
        ]}
        onSelect={vi.fn()}
        onCreate={onCreate}
        onCreateFromTemplate={onCreateFromTemplate}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    await userEvent.click(screen.getByTestId("create-board-button"));
    await userEvent.type(
      screen.getByLabelText("New board name"),
      "Sprint 1"
    );
    await userEvent.selectOptions(
      screen.getByTestId("template-select"),
      "scrum"
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => {
      expect(onCreateFromTemplate).toHaveBeenCalledWith("scrum", "Sprint 1");
    });
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("renders the star and toggles pin state via onTogglePin", async () => {
    const onTogglePin = vi.fn(() => Promise.resolve());
    const pinned = [
      { id: 1, name: "Roadmap", position: 0, pinned: true },
      { id: 2, name: "Bugs", position: 1, pinned: false },
    ];
    render(
      <BoardSwitcher
        boards={pinned}
        activeBoardId={2}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={onTogglePin}
      />
    );
    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    await userEvent.click(screen.getByTestId("pin-2"));
    expect(onTogglePin).toHaveBeenCalledWith(2, true);
  });

  it("places pinned boards above non-pinned ones", async () => {
    render(
      <BoardSwitcher
        boards={[
          { id: 1, name: "Bugs", position: 0, pinned: false },
          { id: 2, name: "Roadmap", position: 1, pinned: true },
        ]}
        activeBoardId={1}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onTogglePin={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    const buttons = screen.getAllByTestId(/^board-option-/);
    expect(buttons[0]).toHaveAttribute("data-testid", "board-option-2");
  });

  it("shows a Recent section when more than one recent id is supplied", async () => {
    render(
      <BoardSwitcher
        boards={BOARDS}
        activeBoardId={1}
        recentBoardIds={[2, 1]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    const recents = screen.getByTestId("board-switcher-recents");
    expect(recents.textContent).toMatch(/Bugs/);
    expect(recents.textContent).toMatch(/Roadmap/);
  });

  it("hides the delete button when only one board exists", async () => {
    render(
      <BoardSwitcher
        boards={[BOARDS[0]]}
        activeBoardId={1}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    await userEvent.click(screen.getByTestId("board-switcher-trigger"));
    expect(screen.queryByLabelText(/delete roadmap/i)).not.toBeInTheDocument();
  });
});
