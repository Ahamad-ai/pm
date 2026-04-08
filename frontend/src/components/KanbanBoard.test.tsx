import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
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
});
