import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsBell } from "@/components/NotificationsBell";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

const samplePayload = {
  username: "alice",
  unread_count: 2,
  notifications: [
    {
      id: 11,
      kind: "mention",
      board_id: 5,
      payload: {
        actor: "bob",
        card_title: "Ship release",
        board_name: "Roadmap",
      },
      read_at: null,
      created_at: "2026-05-09T10:00:00Z",
    },
    {
      id: 12,
      kind: "collaborator_added",
      board_id: 6,
      payload: { actor: "carol", role: "editor", board_name: "Bugs" },
      read_at: null,
      created_at: "2026-05-09T09:00:00Z",
    },
  ],
};

const assignmentPayload = {
  username: "alice",
  unread_count: 1,
  notifications: [
    {
      id: 21,
      kind: "card_assigned",
      board_id: 7,
      payload: {
        actor: "bob",
        card_title: "Ship release",
        board_name: "Roadmap",
        column_title: "In Progress",
      },
      read_at: null,
      created_at: "2026-05-09T10:00:00Z",
    },
  ],
};

describe("NotificationsBell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the unread badge from the API", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, samplePayload)
    );
    render(<NotificationsBell username="alice" />);
    await waitFor(() =>
      expect(screen.getByTestId("notifications-unread-badge")).toHaveTextContent("2")
    );
  });

  it("opens the dropdown and lists notifications", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, samplePayload)
    );
    render(<NotificationsBell username="alice" />);
    await waitFor(() =>
      expect(screen.getByTestId("notifications-bell")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId("notifications-bell"));

    await waitFor(() =>
      expect(screen.getByTestId("notifications-dropdown")).toBeInTheDocument()
    );
    expect(screen.getByText(/mentioned you on/i)).toBeInTheDocument();
    expect(screen.getByText(/added you as editor/i)).toBeInTheDocument();
  });

  it("clicks a notification, marks read, and jumps to the board", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url === "/api/users/me/notifications" && method === "GET") {
        return jsonResponse(200, samplePayload);
      }
      if (
        url === "/api/users/me/notifications/11/read" &&
        method === "POST"
      ) {
        return jsonResponse(200, { unread_count: 1 });
      }
      return jsonResponse(500, { detail: "x" });
    });
    const onJump = vi.fn();

    render(<NotificationsBell username="alice" onJumpToBoard={onJump} />);
    await waitFor(() =>
      expect(screen.getByTestId("notifications-bell")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId("notifications-bell"));
    await screen.findByTestId("notification-11");

    await userEvent.click(screen.getByTestId("notification-11"));

    await waitFor(() => {
      expect(
        calls.some(
          (c) =>
            c.url === "/api/users/me/notifications/11/read" &&
            c.method === "POST"
        )
      ).toBe(true);
    });
    expect(onJump).toHaveBeenCalledWith(5);
  });

  it("formats card_assigned notifications with column context", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, assignmentPayload)
    );
    render(<NotificationsBell username="alice" />);
    await waitFor(() =>
      expect(screen.getByTestId("notifications-bell")).toBeInTheDocument()
    );
    await userEvent.click(screen.getByTestId("notifications-bell"));
    await waitFor(() =>
      expect(
        screen.getByText(/"Ship release" in Roadmap · In Progress assigned to you/)
      ).toBeInTheDocument()
    );
  });

  it("marks all read in one click", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url === "/api/users/me/notifications" && method === "GET") {
        return jsonResponse(200, samplePayload);
      }
      if (url === "/api/users/me/notifications/read-all" && method === "POST") {
        return jsonResponse(200, { marked: 2, unread_count: 0 });
      }
      return jsonResponse(500, { detail: "x" });
    });
    render(<NotificationsBell username="alice" />);
    await screen.findByTestId("notifications-bell");
    await userEvent.click(screen.getByTestId("notifications-bell"));
    await screen.findByTestId("notifications-mark-all-read");
    await userEvent.click(screen.getByTestId("notifications-mark-all-read"));

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url === "/api/users/me/notifications/read-all" &&
            c.method === "POST"
        )
      ).toBe(true)
    );
  });
});
