import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthShell } from "@/components/AuthShell";
import { AUTH_STORAGE_KEY, USERNAME_STORAGE_KEY } from "@/lib/auth";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

const mockNetwork = (overrides?: {
  loginStatus?: number;
  registerStatus?: number;
  loginPayload?: unknown;
}) => {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url === "/api/login" && method === "POST") {
      const status = overrides?.loginStatus ?? 200;
      return jsonResponse(
        status,
        status >= 400
          ? { detail: "Invalid credentials." }
          : overrides?.loginPayload ?? {
              token: "test-token",
              username: "user",
              display_name: "User",
              role: "member",
            }
      );
    }
    if (url === "/api/register" && method === "POST") {
      const status = overrides?.registerStatus ?? 201;
      return jsonResponse(
        status,
        status >= 400
          ? { detail: "Bad request" }
          : {
              token: "new-token",
              username: "newuser",
              display_name: "New User",
              role: "member",
            }
      );
    }
    if (url === "/api/boards" && method === "GET") {
      return jsonResponse(200, { username: "user", boards: [] });
    }
    if (url === "/api/boards" && method === "POST") {
      return jsonResponse(201, {
        username: "user",
        id: 1,
        name: "My Board",
        position: 0,
        board: { columns: [], cards: {} },
      });
    }
    return jsonResponse(500, { detail: "Unexpected" });
  });
};

const fillSignIn = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("AuthShell", () => {
  beforeEach(() => {
    localStorage.clear();
    mockNetwork();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the sign-in form when unauthenticated", async () => {
    render(<AuthShell />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("heading", { name: /welcome back/i })
    ).toBeInTheDocument();
  });

  it("logs in with valid credentials and persists session", async () => {
    render(<AuthShell />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument()
    );

    await fillSignIn("user", "password");

    await waitFor(() =>
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true")
    );
    expect(localStorage.getItem(USERNAME_STORAGE_KEY)).toBe("user");
  });

  it("shows the server's error message on bad credentials", async () => {
    mockNetwork({ loginStatus: 401 });
    render(<AuthShell />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument()
    );

    await fillSignIn("wrong", "credentials");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid credentials/i)
    );
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("can switch to register mode and create an account", async () => {
    render(<AuthShell />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /sign in/i })
      ).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /^register$/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /welcome to kanban studio/i })
      ).toBeInTheDocument()
    );

    await userEvent.type(screen.getByLabelText("Username"), "newuser");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i })
    );

    await waitFor(() =>
      expect(localStorage.getItem(USERNAME_STORAGE_KEY)).toBe("newuser")
    );
  });

  it("rejects short passwords on register without hitting the network", async () => {
    render(<AuthShell />);
    await userEvent.click(screen.getByRole("button", { name: /^register$/i }));

    await userEvent.type(screen.getByLabelText("Username"), "newuser");
    await userEvent.type(screen.getByLabelText("Password"), "abc");
    await userEvent.click(
      screen.getByRole("button", { name: /create account/i })
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /password must be at least 6 characters/i
      )
    );
  });
});
