export const DEMO_USERNAME = "user";
export const DEMO_PASSWORD = "password";
export const AUTH_STORAGE_KEY = "pm-authenticated";
export const TOKEN_STORAGE_KEY = "pm-token";

export const login = async (
  username: string,
  password: string
): Promise<string> => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid credentials.");
  }
  const data = (await response.json()) as { token: string };
  return data.token;
};

export const getToken = (): string | null =>
  localStorage.getItem(TOKEN_STORAGE_KEY);

export const clearToken = (): void =>
  localStorage.removeItem(TOKEN_STORAGE_KEY);
