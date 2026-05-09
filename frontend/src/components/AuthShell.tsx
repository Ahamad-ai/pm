"use client";

import { FormEvent, useEffect, useState } from "react";
import { BackendKanbanBoard } from "@/components/BackendKanbanBoard";
import {
  AUTH_STORAGE_KEY,
  DEMO_PASSWORD,
  DEMO_USERNAME,
  TOKEN_STORAGE_KEY,
  login,
  clearToken,
} from "@/lib/auth";

export const AuthShell = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    setIsAuthenticated(localStorage.getItem(AUTH_STORAGE_KEY) === "true");
    setIsReady(true);
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim();
    const normalizedPassword = password.trim();

    if (
      normalizedUsername !== DEMO_USERNAME ||
      normalizedPassword !== DEMO_PASSWORD
    ) {
      setError("Invalid credentials. Use user / password.");
      return;
    }

    setIsLoggingIn(true);
    setError("");
    try {
      const token = await login(normalizedUsername, normalizedPassword);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setIsAuthenticated(true);
      setUsername("");
      setPassword("");
    } catch {
      // Backend unavailable -- fall back to client-only auth
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setIsAuthenticated(true);
      setUsername("");
      setPassword("");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    clearToken();
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setError("");
  };

  if (!isReady) {
    return null;
  }

  if (!isAuthenticated) {
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
              A focused board for the work that matters today.
            </h1>
            <p className="mt-6 text-base leading-7 text-white/70">
              Drag cards across stages, capture quick notes, and let the AI
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
              Sign in
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
              Project Kanban
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
              Use the demo credentials below to continue.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs text-[var(--navy-dark)]">
              <span className="font-mono text-[var(--secondary-purple)]">user</span>
              <span className="text-[var(--gray-text)]">/</span>
              <span className="font-mono text-[var(--secondary-purple)]">password</span>
            </div>

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                  Username
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-[var(--stroke)] bg-white px-3.5 py-2.5 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
                  placeholder="user"
                  autoComplete="username"
                  aria-label="Username"
                />
              </label>
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
                    autoComplete="current-password"
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
                disabled={isLoggingIn}
                className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_8px_20px_rgba(117,57,145,0.30)] transition hover:brightness-110 disabled:opacity-60"
              >
                {isLoggingIn ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return <BackendKanbanBoard onLogout={handleLogout} />;
};
