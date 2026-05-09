import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollaboratorsModal } from "@/components/CollaboratorsModal";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

const baseCollabs = [
  { username: "bob", display_name: "Bob", role: "editor" },
  { username: "carol", display_name: "Carol", role: "viewer" },
];

describe("CollaboratorsModal", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads and renders existing collaborators", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/boards/1/collaborators") {
        return jsonResponse(200, { board_id: 1, collaborators: baseCollabs });
      }
      return jsonResponse(500, { detail: "x" });
    });

    render(
      <CollaboratorsModal
        username="alice"
        boardId={1}
        boardName="Roadmap"
        ownerUsername="alice"
        isOwner={true}
        onClose={() => undefined}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId("collaborator-bob")).toBeInTheDocument()
    );
    expect(screen.getByTestId("collaborator-carol")).toBeInTheDocument();
  });

  it("adds a collaborator", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init: init ?? {} });
      if (url === "/api/boards/1/collaborators" && (init?.method ?? "GET") === "GET") {
        return jsonResponse(200, { board_id: 1, collaborators: [] });
      }
      if (url === "/api/boards/1/collaborators" && init?.method === "POST") {
        return jsonResponse(201, {
          username: "dave",
          display_name: "Dave",
          role: "viewer",
        });
      }
      return jsonResponse(500, { detail: "x" });
    });

    render(
      <CollaboratorsModal
        username="alice"
        boardId={1}
        boardName="Roadmap"
        ownerUsername="alice"
        isOwner={true}
        onClose={() => undefined}
      />
    );

    await screen.findByTestId("add-collaborator-form");
    await userEvent.type(screen.getByLabelText("Collaborator username"), "dave");
    await userEvent.selectOptions(
      screen.getByLabelText("Collaborator role"),
      "viewer"
    );
    await userEvent.click(screen.getByRole("button", { name: /invite/i }));

    await waitFor(() => {
      const postCalls = calls.filter(
        (c) => c.init.method === "POST" && c.url === "/api/boards/1/collaborators"
      );
      expect(postCalls).toHaveLength(1);
    });
  });

  it("hides the invite form for non-owners", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(200, { board_id: 1, collaborators: baseCollabs })
    );
    render(
      <CollaboratorsModal
        username="bob"
        boardId={1}
        boardName="Roadmap"
        ownerUsername="alice"
        isOwner={false}
        onClose={() => undefined}
      />
    );
    await screen.findByText(/owner: @alice/i);
    expect(
      screen.queryByTestId("add-collaborator-form")
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/only the owner can manage collaborators/i)
    ).toBeInTheDocument();
  });

  it("removes a collaborator", async () => {
    const calls: { url: string; method: string }[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url === "/api/boards/1/collaborators" && method === "GET") {
        return jsonResponse(200, { board_id: 1, collaborators: baseCollabs });
      }
      if (
        url === "/api/boards/1/collaborators/bob" &&
        method === "DELETE"
      ) {
        return jsonResponse(204, {});
      }
      return jsonResponse(500, { detail: "x" });
    });

    render(
      <CollaboratorsModal
        username="alice"
        boardId={1}
        boardName="Roadmap"
        ownerUsername="alice"
        isOwner={true}
        onClose={() => undefined}
      />
    );
    await screen.findByTestId("collaborator-bob");
    await userEvent.click(screen.getByRole("button", { name: /remove bob/i }));

    await waitFor(() => {
      const del = calls.find(
        (c) => c.method === "DELETE" && c.url === "/api/boards/1/collaborators/bob"
      );
      expect(del).toBeDefined();
    });
  });
});
