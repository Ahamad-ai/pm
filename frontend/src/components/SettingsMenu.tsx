"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  changePassword,
  persistAuth,
  updateProfile,
} from "@/lib/auth";

type SettingsMenuProps = {
  username: string;
  displayName: string;
  onProfileUpdated?: (displayName: string) => void;
  onLogout?: () => void;
};

type Mode = "menu" | "profile" | "password";

export function SettingsMenu({
  username,
  displayName,
  onProfileUpdated,
  onLogout,
}: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [draftDisplayName, setDraftDisplayName] = useState(displayName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftDisplayName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setMode("menu");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const reset = () => {
    setMode("menu");
    setError(null);
    setSuccess(null);
    setCurrentPassword("");
    setNewPassword("");
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleaned = draftDisplayName.trim();
    if (!cleaned) {
      setError("Display name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const profile = await updateProfile(cleaned);
      setSuccess("Display name updated.");
      onProfileUpdated?.(profile.display_name ?? cleaned);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await changePassword(currentPassword, newPassword);
      persistAuth(result);
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          reset();
        }}
        className="rounded-full border border-[var(--stroke)] bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="settings-trigger"
      >
        {displayName}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-[var(--stroke)] bg-white p-3 shadow-[var(--shadow)]"
          role="menu"
        >
          {error ? (
            <p
              className="mb-2 rounded-lg border border-[var(--secondary-purple)]/20 bg-[var(--secondary-purple)]/5 px-2 py-1 text-xs text-[var(--secondary-purple)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {success ? (
            <p
              className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
              role="status"
            >
              {success}
            </p>
          ) : null}

          {mode === "menu" ? (
            <ul className="space-y-1 text-sm">
              <li>
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                  Signed in as @{username}
                </p>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setMode("profile")}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-[var(--navy-dark)] hover:bg-[var(--surface-muted)]"
                >
                  Edit profile
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-[var(--navy-dark)] hover:bg-[var(--surface-muted)]"
                  data-testid="open-password-form"
                >
                  Change password
                </button>
              </li>
              {onLogout ? (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onLogout();
                    }}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-[var(--secondary-purple)] hover:bg-[var(--secondary-purple)]/5"
                  >
                    Log out
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}

          {mode === "profile" ? (
            <form onSubmit={handleProfileSubmit} className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                Display name
                <input
                  value={draftDisplayName}
                  onChange={(event) => setDraftDisplayName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--stroke)] px-2 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                  required
                  maxLength={80}
                  aria-label="Display name"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
                >
                  Back
                </button>
              </div>
            </form>
          ) : null}

          {mode === "password" ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-2" data-testid="password-form">
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                Current password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--stroke)] px-2 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                  required
                  aria-label="Current password"
                  autoComplete="current-password"
                />
              </label>
              <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]">
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--stroke)] px-2 py-1.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
                  required
                  minLength={6}
                  aria-label="New password"
                  autoComplete="new-password"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-[var(--secondary-purple)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white"
                >
                  Update
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)]"
                >
                  Back
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
