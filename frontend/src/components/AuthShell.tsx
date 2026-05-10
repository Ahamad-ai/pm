"use client";

import { FormEvent, useEffect, useState } from "react";
import { BackendKanbanBoard } from "@/components/BackendKanbanBoard";
import {
  AUTH_STORAGE_KEY,
  clearToken,
  getStoredDisplayName,
  getStoredUsername,
  login,
  persistAuth,
  registerAccount,
} from "@/lib/auth";

type Mode = "signin" | "register";

function submitButtonLabel(mode: Mode, isSubmitting: boolean): string {
  if (isSubmitting) {
    return mode === "register" ? "Creating account..." : "Signing in...";
  }
  return mode === "register" ? "Create account" : "Sign in";
}

export function AuthShell() {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [activeDisplayName, setActiveDisplayName] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const authed = localStorage.getItem(AUTH_STORAGE_KEY) === "true";
    setIsAuthenticated(authed);
    if (authed) {
      setActiveUsername(getStoredUsername());
      setActiveDisplayName(getStoredDisplayName());
    }
    setIsReady(true);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim();
    const normalizedPassword = password;

    if (!normalizedUsername || !normalizedPassword) {
      setError("Username and password are required.");
      return;
    }

    if (mode === "register" && normalizedPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const result =
        mode === "signin"
          ? await login(normalizedUsername, normalizedPassword)
          : await registerAccount(
              normalizedUsername,
              normalizedPassword,
              displayName.trim() || undefined
            );
      persistAuth(result);
      setIsAuthenticated(true);
      setActiveUsername(result.username);
      setActiveDisplayName(result.display_name ?? result.username);
      setUsername("");
      setPassword("");
      setDisplayName("");
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : "";
      if (mode === "signin") {
        setError(message || "Invalid credentials.");
      } else {
        setError(message || "Could not create account.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    clearToken();
    setIsAuthenticated(false);
    setActiveUsername(null);
    setActiveDisplayName(null);
    setUsername("");
    setPassword("");
    setDisplayName("");
    setError("");
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
  };

  if (!isReady) {
    return null;
  }

  if (isAuthenticated && activeUsername) {
    return (
      <BackendKanbanBoard
        username={activeUsername}
        displayName={activeDisplayName ?? activeUsername}
        onLogout={handleLogout}
      />
    );
  }

  const isRegister = mode === "register";

  return (
    <main className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[var(--navy-dark)] p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.45)_0%,_transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-40 -right-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(236,173,10,0.30)_0%,_transparent_60%)]" />
        <div className="pointer-events-none absolute right-12 top-32 h-[260px] w-[260px] rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.45)_0%,_transparent_70%)]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <span className="font-display text-xl font-semibold text-[var(--accent-yellow)]">K</span>
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            Kanban Studio
          </span>
        </div>
        <div className="relative z-10 max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-white/60">
            Plan / Track / Ship
          </p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05]">
            A focused workspace for the work that matters today.
          </h1>
          <p className="mt-6 text-base leading-7 text-white/70">
            Spin up multiple boards, drag cards through stages, and let the AI
            assistant draft the next move.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3 text-xs font-medium text-white/70">
          {[
            { label: "Backlog", color: "#94a3b8" },
            { label: "In Progress", color: "#ecad0a" },
            { label: "Done", color: "#16a34a" },
          ].map((entry) => (
            <div
              key={entry.label}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur"
            >
              <span
                className="block h-1.5 w-6 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="mt-2 block">{entry.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--navy-dark)]">
              <span className="font-display text-xl font-semibold text-[var(--accent-yellow)]">
                K
              </span>
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-[var(--navy-dark)]">
              Kanban Studio
            </span>
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)] lg:mt-0">
            {isRegister ? "Create an account" : "Sign in"}
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
            {isRegister ? "Welcome to Kanban Studio" : "Welcome back"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
            {isRegister
              ? "Choose a username and password to get started. You'll get your own boards and AI assistant."
              : "Sign in to your boards. Demo: user / password."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Username
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3.5 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
                placeholder="user"
                autoComplete={isRegister ? "username" : "username"}
                aria-label="Username"
              />
            </label>
            {isRegister ? (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                  Display name (optional)
                </span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3.5 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
                  placeholder="Your name"
                  aria-label="Display name"
                />
              </label>
            ) : null}
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Password
              </span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3.5 py-2.5 pr-16 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
                  placeholder="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  aria-label="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--navy-dark)]"
                  aria-label={showPassword ? "Hide" : "Show"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-[var(--secondary-purple)]/20 bg-[var(--secondary-purple)]/5 px-3 py-2 text-sm font-medium text-[var(--secondary-purple)]"
              >
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_8px_20px_rgba(117,57,145,0.30)] transition hover:brightness-110 disabled:opacity-60"
            >
              {submitButtonLabel(mode, isSubmitting)}
            </button>
          </form>
          <p className="mt-6 text-center text-xs text-[var(--gray-text)]">
            {isRegister ? "Already have an account?" : "Need an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(isRegister ? "signin" : "register")}
              className="font-semibold uppercase tracking-[0.15em] text-[var(--primary-blue)] hover:underline"
            >
              {isRegister ? "Sign in" : "Register"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
