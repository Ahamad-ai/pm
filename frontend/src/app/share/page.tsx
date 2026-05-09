"use client";

import { useEffect, useState } from "react";
import { PublicBoardView } from "@/components/PublicBoardView";
import type { BoardData } from "@/lib/kanban";

type PublicBoardPayload = {
  id: number;
  name: string;
  owner?: string | null;
  updated_at?: string | null;
  board: BoardData;
};

export default function SharePage() {
  const [data, setData] = useState<PublicBoardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams(window.location.search);
      const value = params.get("token");
      if (cancelled) return;
      setToken(value);
      if (!value) {
        if (!cancelled) {
          setError("No share token in URL.");
        }
        return;
      }
      try {
        const response = await fetch(
          `/api/public/boards/${encodeURIComponent(value)}`
        );
        if (!response.ok) {
          let detail = "";
          try {
            detail = ((await response.json()) as { detail?: string })?.detail ?? "";
          } catch {
            detail = "";
          }
          if (!cancelled) {
            setError(detail || "This share link isn't valid anymore.");
          }
          return;
        }
        const payload = (await response.json()) as PublicBoardPayload;
        if (!cancelled) {
          setData(payload);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load the shared board.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
        <div
          className="max-w-md rounded-2xl border border-[var(--stroke)] bg-white p-6 text-center shadow-[var(--shadow)]"
          role="alert"
          data-testid="share-error"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--secondary-purple)]">
            Share link
          </p>
          <h1 className="mt-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
            Board unavailable
          </h1>
          <p className="mt-2 text-sm text-[var(--gray-text)]">{error}</p>
        </div>
      </main>
    );
  }

  if (!token || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-6">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]"
          data-testid="share-loading"
        >
          Loading shared board…
        </p>
      </main>
    );
  }

  return (
    <PublicBoardView
      name={data.name}
      owner={data.owner ?? null}
      updatedAt={data.updated_at ?? null}
      board={data.board}
    />
  );
}
