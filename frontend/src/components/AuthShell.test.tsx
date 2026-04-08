import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthShell } from "@/components/AuthShell";
import { AUTH_STORAGE_KEY } from "@/lib/auth";

const login = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText("Username"), username);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("AuthShell", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows login form when unauthenticated", async () => {
    render(<AuthShell />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Project Kanban" })).toBeInTheDocument()
    );
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("logs in with valid credentials and supports logout", async () => {
    render(<AuthShell />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
    );

    await login("user", "password");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument()
    );
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Project Kanban" })).toBeInTheDocument()
    );
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("can log in again after logout", async () => {
    render(<AuthShell />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
    );

    await login("user", "password");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Project Kanban" })).toBeInTheDocument()
    );

    await login(" user ", " password ");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument()
    );
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe("true");
  });

  it("rejects invalid credentials", async () => {
    render(<AuthShell />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument()
    );

    await login("wrong", "credentials");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid credentials. Use user / password."
    );
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("respects persisted auth state", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    render(<AuthShell />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument()
    );
    const logout = screen.getByRole("button", { name: /log out/i });
    expect(within(logout).queryByText(/sign in/i)).not.toBeInTheDocument();
  });
});
