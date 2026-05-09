import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsMenu } from "@/components/SettingsMenu";

const jsonResponse = (status: number, payload: unknown): Response =>
  ({
    ok: status < 400,
    status,
    json: async () => payload,
  }) as Response;

describe("SettingsMenu", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("changes password through the API", async () => {
    const calls: { url: string; body: string }[] = [];
    vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/users/me/password") {
        calls.push({ url, body: (init?.body as string) ?? "" });
        return jsonResponse(200, {
          token: "fresh-token",
          username: "alice",
          display_name: "Alice",
          role: "member",
        });
      }
      return jsonResponse(500, { detail: "Unexpected" });
    });

    render(
      <SettingsMenu username="alice" displayName="Alice" />
    );
    await userEvent.click(screen.getByTestId("settings-trigger"));
    await userEvent.click(screen.getByTestId("open-password-form"));

    await userEvent.type(screen.getByLabelText("Current password"), "secret123");
    await userEvent.type(screen.getByLabelText("New password"), "newpass456");
    await userEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/password updated/i)
    );
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].body);
    expect(body.current_password).toBe("secret123");
    expect(body.new_password).toBe("newpass456");
  });

  it("shows server error when password change fails", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse(401, { detail: "Current password is incorrect." })
    );

    render(
      <SettingsMenu username="alice" displayName="Alice" />
    );
    await userEvent.click(screen.getByTestId("settings-trigger"));
    await userEvent.click(screen.getByTestId("open-password-form"));

    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.type(screen.getByLabelText("New password"), "newpass456");
    await userEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/current password/i)
    );
  });

  it("calls onLogout from the menu", async () => {
    const onLogout = vi.fn();
    render(
      <SettingsMenu
        username="alice"
        displayName="Alice"
        onLogout={onLogout}
      />
    );
    await userEvent.click(screen.getByTestId("settings-trigger"));
    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
