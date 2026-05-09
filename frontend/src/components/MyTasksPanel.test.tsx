import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MyTasksPanel } from "@/components/MyTasksPanel";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

const tasksPayload = {
  username: "alice",
  tasks: [
    {
      board_id: 1,
      board_name: "A Board",
      column_title: "To do",
      card_id: "c1",
      title: "Overdue task",
      details: "",
      priority: "high",
      due_date: "2000-01-01",
      labels: [],
      overdue: true,
      due_in_days: -1000,
      subtasks: [],
    },
    {
      board_id: 2,
      board_name: "B Board",
      column_title: "In Progress",
      card_id: "c2",
      title: "Future task",
      details: "",
      priority: "low",
      due_date: "2999-01-01",
      labels: [],
      overdue: false,
      due_in_days: 100,
      subtasks: [],
    },
  ],
};

describe("MyTasksPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <MyTasksPanel
        username="alice"
        isOpen={false}
        onClose={() => undefined}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("loads tasks and shows overdue + total counts", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, tasksPayload)
    );

    render(
      <MyTasksPanel
        username="alice"
        isOpen={true}
        onClose={() => undefined}
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/Overdue task/)).toBeInTheDocument()
    );
    expect(screen.getByText(/2 total/)).toBeInTheDocument();
    expect(screen.getByText(/1 overdue/)).toBeInTheDocument();
  });

  it("calls onJumpToBoard when a task is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, tasksPayload)
    );
    const onJump = vi.fn();
    render(
      <MyTasksPanel
        username="alice"
        isOpen={true}
        onClose={() => undefined}
        onJumpToBoard={onJump}
      />
    );
    await waitFor(() =>
      expect(screen.getByTestId("task-1-c1")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId("task-1-c1"));
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it("shows an empty state when no tasks are returned", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, { username: "alice", tasks: [] })
    );
    render(
      <MyTasksPanel
        username="alice"
        isOpen={true}
        onClose={() => undefined}
      />
    );
    await waitFor(() =>
      expect(screen.getByText(/Nothing assigned to you/i)).toBeInTheDocument()
    );
  });

  it("shows error on fetch failure", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(500, { detail: "boom" })
    );
    render(
      <MyTasksPanel
        username="alice"
        isOpen={true}
        onClose={() => undefined}
      />
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument()
    );
  });
});
