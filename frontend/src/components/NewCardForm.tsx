import { useState, type CSSProperties, type FormEvent } from "react";
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  type CardPriority,
} from "@/lib/kanban";

export type NewCardInput = {
  title: string;
  details: string;
  priority?: CardPriority;
  dueDate?: string;
  labels?: string[];
};

const initialFormState: {
  title: string;
  details: string;
  priority: CardPriority | "";
  dueDate: string;
  labels: string;
} = {
  title: "",
  details: "",
  priority: "",
  dueDate: "",
  labels: "",
};

type NewCardFormProps = {
  onAdd: (input: NewCardInput) => void;
  accentColor?: string;
};

export const NewCardForm = ({ onAdd, accentColor = "var(--primary-blue)" }: NewCardFormProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formState, setFormState] = useState(initialFormState);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.title.trim()) {
      return;
    }
    const labels = formState.labels
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
    onAdd({
      title: formState.title.trim(),
      details: formState.details.trim(),
      priority: formState.priority || undefined,
      dueDate: formState.dueDate || undefined,
      labels: labels.length > 0 ? labels : undefined,
    });
    setFormState(initialFormState);
    setIsOpen(false);
  };

  const buttonStyle: CSSProperties = {
    color: accentColor,
    borderColor: "transparent",
  };

  return (
    <div className="mt-3">
      {isOpen ? (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Card title"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm font-medium text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
            required
            autoFocus
          />
          <textarea
            value={formState.details}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, details: event.target.value }))
            }
            placeholder="Details"
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--gray-text)] outline-none transition focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-[var(--primary-blue)]/20"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={formState.priority}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  priority: event.target.value as CardPriority | "",
                }))
              }
              className="rounded-xl border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              aria-label="Priority"
            >
              <option value="">Priority…</option>
              {PRIORITY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABEL[value]}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={formState.dueDate}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, dueDate: event.target.value }))
              }
              className="rounded-xl border border-[var(--stroke)] bg-white px-2 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              aria-label="Due date"
            />
          </div>
          <input
            value={formState.labels}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, labels: event.target.value }))
            }
            placeholder="Labels (comma-separated)"
            className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_4px_12px_rgba(117,57,145,0.25)] transition hover:brightness-110"
            >
              Add card
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setFormState(initialFormState);
              }}
              className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          style={buttonStyle}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--stroke)] bg-transparent px-3 py-2 text-xs font-semibold uppercase tracking-wide transition hover:bg-[var(--surface-muted)]"
        >
          <span className="text-base leading-none">+</span>
          Add a card
        </button>
      )}
    </div>
  );
};
