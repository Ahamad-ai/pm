import type { CSSProperties } from "react";
import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
  accentColor?: string;
};

export function KanbanCardPreview({
  card,
  accentColor = "#209dd7",
}: KanbanCardPreviewProps) {
  const style: CSSProperties = { borderLeftColor: accentColor };
  return (
    <article
      style={style}
      className="cursor-grabbing rounded-2xl border border-[var(--stroke)] border-l-[3px] bg-white px-4 py-3.5 shadow-[0_18px_32px_rgba(3,33,71,0.18)]"
    >
      <h4 className="font-display text-[15px] font-semibold leading-snug text-[var(--navy-dark)]">
        {card.title}
      </h4>
      <p className="mt-1.5 text-[13px] leading-6 text-[var(--gray-text)]">{card.details}</p>
    </article>
  );
}
