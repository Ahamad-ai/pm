"use client";

import { FormEvent, useMemo, useState } from "react";
import type { ChatHistoryMessage } from "@/lib/boardApi";

type ChatSidebarProps = {
  messages: ChatHistoryMessage[];
  isSending: boolean;
  error: string | null;
  onSend: (message: string) => Promise<void>;
};

export const ChatSidebar = ({
  messages,
  isSending,
  error,
  onSend,
}: ChatSidebarProps) => {
  const [draft, setDraft] = useState("");

  const canSubmit = useMemo(
    () => !isSending && draft.trim().length > 0,
    [isSending, draft]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) {
      return;
    }
    setDraft("");
    await onSend(message);
  };

  return (
    <aside className="fixed inset-y-4 right-4 z-30 flex w-[360px] flex-col rounded-3xl border border-[var(--stroke)] bg-white/95 p-4 shadow-[var(--shadow)] backdrop-blur">
      <div className="mb-3 border-b border-[var(--stroke)] pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
          AI Assistant
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
          Chat
        </h2>
        <p className="mt-2 text-xs text-[var(--gray-text)]">
          Ask to create, edit, or move cards.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1" data-testid="chat-messages">
        {messages.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--stroke)] px-3 py-4 text-xs text-[var(--gray-text)]">
            Try: "Add a card in Backlog to draft the release notes."
          </p>
        ) : null}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-8 rounded-2xl bg-[var(--primary-blue)] px-3 py-2 text-sm text-white"
                : "mr-8 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)]"
            }
          >
            {message.content}
          </div>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--secondary-purple)]">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask the assistant..."
          rows={3}
          className="w-full resize-none rounded-2xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
};
