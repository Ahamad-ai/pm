"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/boardApi";

type NotificationsBellProps = {
  username: string;
  refreshKey?: number;
  onJumpToBoard?: (boardId: number) => void;
};

const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatNotification = (n: Notification): string => {
  const payload = (n.payload ?? {}) as Record<string, string>;
  if (n.kind === "mention") {
    const card = payload.card_title ?? "a card";
    const board = payload.board_name ?? "a board";
    return `@${payload.actor} mentioned you on "${card}" in ${board}`;
  }
  if (n.kind === "collaborator_added") {
    const role = payload.role ?? "collaborator";
    const board = payload.board_name ?? "a board";
    return `@${payload.actor} added you as ${role} on ${board}`;
  }
  if (n.kind === "card_assigned") {
    const card = payload.card_title ?? "a card";
    const board = payload.board_name ?? "a board";
    const column = payload.column_title;
    const where = column ? `${board} · ${column}` : board;
    return `"${card}" in ${where} assigned to you`;
  }
  return n.kind;
};

export const NotificationsBell = ({
  username,
  refreshKey,
  onJumpToBoard,
}: NotificationsBellProps) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    try {
      const data = await fetchNotifications(username);
      setNotifications(data.notifications);
      setUnread(data.unread_count);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchNotifications(username);
        if (!cancelled) {
          setNotifications(data.notifications);
          setUnread(data.unread_count);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [username, refreshKey]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = async (notification: Notification) => {
    setOpen(false);
    if (!notification.read_at) {
      try {
        const remaining = await markNotificationRead(
          username,
          notification.id
        );
        setUnread(remaining);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
      } catch {
        // ignore
      }
    }
    if (notification.board_id) {
      onJumpToBoard?.(notification.board_id);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllNotificationsRead(username);
      setUnread(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) {
            void refresh();
          }
        }}
        className="relative rounded-full border border-[var(--stroke)] bg-white px-3 py-1.5 text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        data-testid="notifications-bell"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
          <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unread > 0 ? (
          <span
            className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-[var(--secondary-purple)] px-1 text-[9px] font-bold text-white"
            data-testid="notifications-unread-badge"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-[var(--stroke)] bg-white p-3 shadow-[var(--shadow)]"
          role="menu"
          data-testid="notifications-dropdown"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              Notifications
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--primary-blue)] hover:underline"
                data-testid="notifications-mark-all-read"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="text-xs text-[var(--secondary-purple)]" role="alert">
              {error}
            </p>
          ) : notifications.length === 0 ? (
            <p className="text-xs text-[var(--gray-text)]">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {notifications.map((notification) => {
                const isUnread = !notification.read_at;
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(notification)}
                      className={clsx(
                        "block w-full rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-[var(--surface-muted)]",
                        isUnread && "bg-[var(--primary-blue)]/5"
                      )}
                      data-testid={`notification-${notification.id}`}
                    >
                      <p className="text-[var(--navy-dark)]">
                        {isUnread ? <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--primary-blue)] align-middle" aria-hidden="true" /> : null}
                        {formatNotification(notification)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-[var(--gray-text)]">
                        {formatTime(notification.created_at)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
};
