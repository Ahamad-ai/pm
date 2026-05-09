import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardDetailModal } from "@/components/CardDetailModal";
import type { Card } from "@/lib/kanban";

const baseCard: Card = {
  id: "card-1",
  title: "Original title",
  details: "Original **details**.",
  priority: "high",
  dueDate: "2026-12-31",
  assignee: "alice",
  labels: ["release"],
  subtasks: [
    { id: "s1", title: "Write tests", done: true },
    { id: "s2", title: "Update docs", done: false },
  ],
  comments: [
    {
      id: "cm1",
      author: "alice",
      body: "Ping @bob about this",
      createdAt: "2026-05-09T10:00:00Z",
    },
  ],
};

describe("CardDetailModal", () => {
  it("renders all fields and the column title", () => {
    render(
      <CardDetailModal
        card={baseCard}
        columnTitle="In Progress"
        canEdit={true}
        currentUser="alice"
        onChange={() => undefined}
        onClose={() => undefined}
      />
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByLabelText("Card title")).toHaveValue("Original title");
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
    expect(screen.getByText(/2 \/ 0|1\/2/)).toBeInTheDocument(); // checklist progress
    expect(screen.getByLabelText("Toggle Write tests")).toBeChecked();
  });

  it("emits a title change on blur", async () => {
    const onChange = vi.fn();
    render(
      <CardDetailModal
        card={baseCard}
        canEdit={true}
        currentUser="alice"
        onChange={onChange}
        onClose={() => undefined}
      />
    );
    const titleInput = screen.getByLabelText("Card title");
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, "New title");
    titleInput.blur();
    expect(onChange).toHaveBeenCalledWith({ title: "New title" });
  });

  it("toggles a subtask", async () => {
    const onChange = vi.fn();
    render(
      <CardDetailModal
        card={baseCard}
        canEdit={true}
        currentUser="alice"
        onChange={onChange}
        onClose={() => undefined}
      />
    );
    await userEvent.click(screen.getByLabelText("Toggle Update docs"));
    expect(onChange).toHaveBeenCalledWith({
      subtasks: [
        { id: "s1", title: "Write tests", done: true },
        { id: "s2", title: "Update docs", done: true },
      ],
    });
  });

  it("posts a new comment", async () => {
    const onChange = vi.fn();
    render(
      <CardDetailModal
        card={baseCard}
        canEdit={true}
        currentUser="alice"
        onChange={onChange}
        onClose={() => undefined}
      />
    );
    await userEvent.type(
      screen.getByLabelText("Add a comment"),
      "Looks good"
    );
    await userEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const arg = onChange.mock.calls[0][0];
    expect(arg.comments).toHaveLength(2);
    expect(arg.comments[1].body).toBe("Looks good");
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <CardDetailModal
        card={baseCard}
        canEdit={true}
        currentUser="alice"
        onChange={() => undefined}
        onClose={onClose}
      />
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("hides editing controls when canEdit is false", () => {
    render(
      <CardDetailModal
        card={baseCard}
        canEdit={false}
        currentUser="alice"
        onChange={() => undefined}
        onClose={() => undefined}
      />
    );
    expect(screen.queryByLabelText("Card title")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-modal-archive")).not.toBeInTheDocument();
  });

  it("adds an attachment via the form", async () => {
    const onChange = vi.fn();
    render(
      <CardDetailModal
        card={{ ...baseCard, attachments: [] }}
        canEdit={true}
        currentUser="alice"
        onChange={onChange}
        onClose={() => undefined}
      />
    );
    await userEvent.type(screen.getByLabelText("Attachment label"), "Spec");
    await userEvent.type(
      screen.getByLabelText("Attachment URL"),
      "https://docs.example.com/spec"
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(onChange).toHaveBeenCalled();
    const arg = onChange.mock.calls[0][0];
    expect(arg.attachments).toHaveLength(1);
    expect(arg.attachments[0].url).toBe("https://docs.example.com/spec");
  });

  it("rejects an attachment URL without an http(s) prefix", async () => {
    const onChange = vi.fn();
    render(
      <CardDetailModal
        card={{ ...baseCard, attachments: [] }}
        canEdit={true}
        currentUser="alice"
        onChange={onChange}
        onClose={() => undefined}
      />
    );
    await userEvent.type(screen.getByLabelText("Attachment label"), "Bad");
    await userEvent.type(
      screen.getByLabelText("Attachment URL"),
      "javascript:alert(1)"
    );
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/http/i);
  });

  it("starts a timer and records an open entry", async () => {
    const onChange = vi.fn();
    render(
      <CardDetailModal
        card={{ ...baseCard, timeEntries: [] }}
        canEdit={true}
        currentUser="alice"
        onChange={onChange}
        onClose={() => undefined}
      />
    );
    await userEvent.click(screen.getByTestId("start-timer"));
    const arg = onChange.mock.calls[0][0];
    expect(arg.timeEntries).toHaveLength(1);
    expect(arg.timeEntries[0].endedAt).toBeUndefined();
  });

  it("stops the running timer and writes endedAt + seconds", async () => {
    const onChange = vi.fn();
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    render(
      <CardDetailModal
        card={{
          ...baseCard,
          timeEntries: [{ id: "t-running", startedAt }],
        }}
        canEdit={true}
        currentUser="alice"
        onChange={onChange}
        onClose={() => undefined}
      />
    );
    await userEvent.click(screen.getByTestId("stop-timer"));
    const arg = onChange.mock.calls[0][0];
    expect(arg.timeEntries[0].endedAt).toBeTruthy();
    expect(arg.timeEntries[0].seconds).toBeGreaterThanOrEqual(50);
  });

  it("renders @mentions inside comment bodies", () => {
    render(
      <CardDetailModal
        card={baseCard}
        canEdit={true}
        currentUser="alice"
        onChange={() => undefined}
        onClose={() => undefined}
      />
    );
    expect(screen.getByText("@bob")).toBeInTheDocument();
  });
});
