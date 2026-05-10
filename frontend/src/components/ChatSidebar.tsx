"use client";

import clsx from "clsx";
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown from "react-markdown";
import type { ChatHistoryMessage } from "@/lib/boardApi";

type ChatSidebarProps = {
  messages: ChatHistoryMessage[];
  isSending: boolean;
  error: string | null;
  isOpen?: boolean;
  onToggle?: () => void;
  onSend: (message: string) => Promise<void>;
};

const SUGGESTIONS = [
  "Add a card in Backlog to draft the release notes.",
  "Move the prototype card to In Progress.",
  "Summarize the board for me.",
];

export function ChatSidebar({
  messages,
  isSending,
  error,
  isOpen = true,
  onToggle,
  onSend,
}: ChatSidebarProps) {
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canSubmit = useMemo(
    () => !isSending && draft.trim().length > 0,
    [isSending, draft]
  );

  useEffect(() => {
    const node = messagesEndRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isSending]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) {
      return;
    }
    setDraft("");
    await onSend(message);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSubmit) {
        event.currentTarget.form?.requestSubmit();
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] shadow-[var(--shadow)] transition hover:border-[var(--secondary-purple)] hover:text-[var(--secondary-purple)]"
        aria-label="Open AI assistant"
        data-testid="chat-open"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
          <path d="M12 3a9 9 0 0 0-9 9c0 1.84.55 3.55 1.5 4.98L3 21l4.16-1.36A9 9 0 1 0 12 3zm-3.5 10a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
        </svg>
        AI Assistant
      </button>
    );
  }

  return (
    <aside
      className="fixed bottom-4 right-4 top-16 z-30 flex w-[min(360px,calc(100vw-2rem))] flex-col rounded-3xl border border-[var(--stroke)] bg-white/95 p-4 shadow-[var(--shadow)] backdrop-blur"
      data-testid="chat-sidebar"
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--stroke)] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary-purple)]/10 text-[var(--secondary-purple)]"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <path d="M12 3a9 9 0 0 0-9 9c0 1.84.55 3.55 1.5 4.98L3 21l4.16-1.36A9 9 0 1 0 12 3zm-3.5 10a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--gray-text)]">
              AI Assistant
            </p>
            <h2 className="font-display text-base font-semibold text-[var(--navy-dark)]">
              Chat
            </h2>
          </div>
        </div>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className="shrink-0 rounded-full border border-[var(--stroke)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
            aria-label="Collapse AI assistant"
            data-testid="chat-collapse"
          >
            Hide
          </button>
        ) : null}
      </div>

      <div
        className="scroll-thin flex-1 space-y-3 overflow-y-auto pr-1"
        data-testid="chat-messages"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="rounded-2xl border border-dashed border-[var(--stroke)] bg-[var(--surface)] px-3 py-3 text-xs leading-5 text-[var(--gray-text)]">
              Ask the assistant to create, edit, or rearrange cards. Try one of these to get started:
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setDraft(suggestion)}
                  className="rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-left text-xs leading-5 text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:bg-[var(--primary-blue)]/5 hover:text-[var(--primary-blue)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={clsx(
              "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6",
              message.role === "user"
                ? "ml-auto bg-[var(--primary-blue)] text-white shadow-[0_6px_14px_rgba(32,157,215,0.25)]"
                : "chat-markdown mr-auto border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
            )}
          >
            {message.role === "assistant" ? (
              <Markdown>{message.content}</Markdown>
            ) : (
              message.content
            )}
          </div>
        ))}

        {isSending ? (
          <div className="mr-auto inline-flex items-center gap-1.5 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--gray-text)]" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--gray-text)]" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--gray-text)]" />
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-[var(--secondary-purple)]/20 bg-[var(--secondary-purple)]/5 px-3 py-2 text-xs font-semibold text-[var(--secondary-purple)]">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the assistant... (Enter to send, Shift+Enter for newline)"
          rows={3}
          className="scroll-thin w-full resize-none rounded-2xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[0_8px_20px_rgba(117,57,145,0.25)] transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
}
