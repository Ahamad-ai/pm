import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardFilterBar } from "@/components/CardFilterBar";
import type { CardFilter } from "@/lib/kanban";

const renderBar = (overrides?: Partial<Parameters<typeof CardFilterBar>[0]>) => {
  const onChange = vi.fn();
  const props = {
    filter: {} as CardFilter,
    availableLabels: ["docs", "ui"],
    availableAssignees: ["alice", "bob"],
    onChange,
    matchCount: 5,
    totalCount: 5,
    ...overrides,
  };
  render(<CardFilterBar {...props} />);
  return { onChange, props };
};

describe("CardFilterBar", () => {
  it("emits a query change", async () => {
    const { onChange } = renderBar();
    await userEvent.type(screen.getByLabelText("Search cards"), "x");
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ query: "x" }));
  });

  it("toggles a priority pill", async () => {
    const { onChange } = renderBar();
    await userEvent.click(screen.getByTestId("filter-priority-high"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ priorities: ["high"] })
    );
  });

  it("shows match counts when filtered", () => {
    renderBar({
      filter: { query: "x" },
      matchCount: 2,
      totalCount: 5,
    });
    expect(screen.getByText(/2 of 5 cards/)).toBeInTheDocument();
  });

  it("offers to save the current filter as a view", async () => {
    const onSaveView = vi.fn(() => Promise.resolve());
    const onChange = vi.fn();
    render(
      <CardFilterBar
        filter={{ query: "x" }}
        availableLabels={[]}
        availableAssignees={[]}
        onChange={onChange}
        matchCount={1}
        totalCount={5}
        savedViews={[]}
        canEditViews={true}
        onSaveView={onSaveView}
      />
    );
    await userEvent.click(screen.getByTestId("save-view"));
    await userEvent.type(
      screen.getByLabelText("Saved view name"),
      "My filter"
    );
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(onSaveView).toHaveBeenCalledWith("My filter", { query: "x" });
    });
  });

  it("applies a saved view", async () => {
    const onChange = vi.fn();
    render(
      <CardFilterBar
        filter={{}}
        availableLabels={[]}
        availableAssignees={[]}
        onChange={onChange}
        matchCount={5}
        totalCount={5}
        savedViews={[
          {
            id: "v-1",
            name: "Bugs only",
            filter: { labels: ["bug"] },
          },
        ]}
        canEditViews={true}
      />
    );
    await userEvent.selectOptions(
      screen.getByTestId("apply-saved-view"),
      "v-1"
    );
    expect(onChange).toHaveBeenCalledWith({ labels: ["bug"] });
  });

  it("clears all filters", async () => {
    const { onChange } = renderBar({
      filter: { query: "x", priorities: ["high"] },
      matchCount: 1,
      totalCount: 5,
    });
    await userEvent.click(screen.getByTestId("clear-filter"));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
