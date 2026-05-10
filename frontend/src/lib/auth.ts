export const DEMO_USERNAME = "user";
export const DEMO_PASSWORD = "password";
export const AUTH_STORAGE_KEY = "pm-authenticated";
export const TOKEN_STORAGE_KEY = "pm-token";
export const USERNAME_STORAGE_KEY = "pm-username";
export const DISPLAY_NAME_STORAGE_KEY = "pm-display-name";

export type AuthResult = {
  token: string;
  username: string;
  display_name?: string | null;
  role?: string;
};

export type Profile = {
  username: string;
  display_name?: string | null;
  role: string;
};

async function readDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? "";
  } catch {
    return "";
  }
}

async function throwIfNotOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const detail = await readDetail(response);
  throw new Error(detail || `${fallback} (${response.status})`);
}

async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(response, fallback);
  return (await response.json()) as T;
}

export function login(username: string, password: string): Promise<AuthResult> {
  return postJson<AuthResult>("/api/login", { username, password }, "Request failed");
}

export function registerAccount(
  username: string,
  password: string,
  displayName?: string
): Promise<AuthResult> {
  return postJson<AuthResult>(
    "/api/register",
    { username, password, display_name: displayName },
    "Request failed"
  );
}

export function persistAuth(result: AuthResult): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
  localStorage.setItem(AUTH_STORAGE_KEY, "true");
  localStorage.setItem(USERNAME_STORAGE_KEY, result.username);
  if (result.display_name) {
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, result.display_name);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_STORAGE_KEY);
}

export function getStoredDisplayName(): string | null {
  return localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
  localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
}

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(path, { ...init, headers });
}

export async function fetchProfile(): Promise<Profile> {
  const response = await authedFetch("/api/users/me");
  await throwIfNotOk(response, "Profile fetch failed");
  return (await response.json()) as Profile;
}

export async function updateProfile(displayName: string): Promise<Profile> {
  const response = await authedFetch("/api/users/me", {
    method: "PUT",
    body: JSON.stringify({ display_name: displayName }),
  });
  await throwIfNotOk(response, "Profile update failed");
  return (await response.json()) as Profile;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> {
  const response = await authedFetch("/api/users/me/password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  await throwIfNotOk(response, "Password change failed");
  return (await response.json()) as AuthResult;
}
