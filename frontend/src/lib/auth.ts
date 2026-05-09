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

const post = async (path: string, body: unknown): Promise<AuthResult> => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? "";
    } catch {
      detail = "";
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return (await response.json()) as AuthResult;
};

export const login = async (
  username: string,
  password: string
): Promise<AuthResult> => {
  return post("/api/login", { username, password });
};

export const registerAccount = async (
  username: string,
  password: string,
  displayName?: string
): Promise<AuthResult> => {
  return post("/api/register", {
    username,
    password,
    display_name: displayName,
  });
};

export const persistAuth = (result: AuthResult): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
  localStorage.setItem(AUTH_STORAGE_KEY, "true");
  localStorage.setItem(USERNAME_STORAGE_KEY, result.username);
  if (result.display_name) {
    localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, result.display_name);
  }
};

export const getToken = (): string | null =>
  localStorage.getItem(TOKEN_STORAGE_KEY);

export const getStoredUsername = (): string | null =>
  localStorage.getItem(USERNAME_STORAGE_KEY);

export const getStoredDisplayName = (): string | null =>
  localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
  localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
};

export type Profile = {
  username: string;
  display_name?: string | null;
  role: string;
};

const authedFetch = async (
  path: string,
  init?: RequestInit
): Promise<Response> => {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(path, { ...init, headers });
};

const readDetail = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ?? "";
  } catch {
    return "";
  }
};

export const fetchProfile = async (): Promise<Profile> => {
  const response = await authedFetch("/api/users/me");
  if (!response.ok) {
    throw new Error((await readDetail(response)) || `Profile fetch failed (${response.status})`);
  }
  return (await response.json()) as Profile;
};

export const updateProfile = async (displayName: string): Promise<Profile> => {
  const response = await authedFetch("/api/users/me", {
    method: "PUT",
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!response.ok) {
    throw new Error((await readDetail(response)) || `Profile update failed (${response.status})`);
  }
  return (await response.json()) as Profile;
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<AuthResult> => {
  const response = await authedFetch("/api/users/me/password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!response.ok) {
    throw new Error((await readDetail(response)) || `Password change failed (${response.status})`);
  }
  return (await response.json()) as AuthResult;
};
