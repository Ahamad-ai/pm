import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders four default columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/^column-col-/i)).toHaveLength(4);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /drop new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("edits an existing card", async () => {
    render(<KanbanBoard />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: /edit align roadmap themes/i }));

    const titleInput = within(card).getByLabelText(/edit title for align roadmap themes/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "Updated roadmap title");

    const detailsInput = within(card).getByLabelText(/edit details for align roadmap themes/i);
    await userEvent.clear(detailsInput);
    await userEvent.type(detailsInput, "Updated roadmap details");

    await userEvent.click(within(card).getByRole("button", { name: /save/i }));
    expect(screen.getByText("Updated roadmap title")).toBeInTheDocument();
    expect(screen.getByText("Updated roadmap details")).toBeInTheDocument();
  });

  it("adds a new column from the trailing tile", async () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/^column-col-/i)).toHaveLength(4);

    await userEvent.click(screen.getByTestId("add-column-button"));
    await userEvent.type(
      screen.getByLabelText("New column title"),
      "Blocked"
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(screen.getAllByTestId(/^column-col-/i)).toHaveLength(5);
    expect(screen.getByDisplayValue("Blocked")).toBeInTheDocument();
  });

  it("archives and restores a card via its action button", async () => {
    render(<KanbanBoard />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByTestId("archive-card-1"));
    // Card disappears from its column.
    expect(screen.queryByTestId("card-card-1")).not.toBeInTheDocument();
  });

  it("enters bulk-select mode and archives selected cards", async () => {
    render(<KanbanBoard />);
    await userEvent.click(screen.getByTestId("bulk-select-toggle"));
    await userEvent.click(screen.getByTestId("select-card-card-1"));
    await userEvent.click(screen.getByTestId("select-card-card-2"));
    await userEvent.click(screen.getByTestId("bulk-archive"));

    expect(screen.queryByTestId("card-card-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-card-2")).not.toBeInTheDocument();
  });

  it("links a card via the modal", async () => {
    render(<KanbanBoard />);
    await userEvent.click(screen.getByTestId("open-card-card-1"));
    const linkSelect = screen.getByTestId("link-card-select");
    await userEvent.selectOptions(linkSelect, "card-3");
    expect(screen.getByTestId("linked-card-card-3")).toBeInTheDocument();
  });

  it("captures priority, labels, and assignee when adding a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));

    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Priority task");
    await userEvent.selectOptions(within(column).getByLabelText("Priority"), "high");
    await userEvent.type(
      within(column).getByPlaceholderText(/labels/i),
      "design, ux"
    );
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("Priority task")).toBeInTheDocument();
    expect(within(column).getByText("design")).toBeInTheDocument();
    expect(within(column).getByText("ux")).toBeInTheDocument();
  });
});
