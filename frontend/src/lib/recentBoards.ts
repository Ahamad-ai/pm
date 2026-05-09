const KEY_PREFIX = "pm-recent-boards:";
const MAX_RECENTS = 5;

const getKey = (username: string): string => `${KEY_PREFIX}${username}`;

const safeParse = (raw: string | null): number[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is number => typeof value === "number")
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
};

export const getRecentBoardIds = (username: string): number[] => {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(getKey(username)));
};

export const recordRecentBoard = (
  username: string,
  boardId: number
): number[] => {
  if (typeof window === "undefined") return [];
  const existing = safeParse(window.localStorage.getItem(getKey(username)));
  const next = [boardId, ...existing.filter((id) => id !== boardId)].slice(
    0,
    MAX_RECENTS
  );
  window.localStorage.setItem(getKey(username), JSON.stringify(next));
  return next;
};

export const clearRecentBoards = (username: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(getKey(username));
};
