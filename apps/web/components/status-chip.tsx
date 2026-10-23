import { Check, Circle } from "lucide-react";

export type GuideStatus = "published" | "draft";

/** Chip de estado (Figma «✓ Publicada · Borrador»). El estado siempre lleva texto, no solo color. */
export function StatusChip({ status }: { status: GuideStatus }) {
  const published = status === "published";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control border border-line px-2.5 py-1 text-meta font-semibold ${
        published ? "bg-tint text-ink" : "bg-surface text-muted"
      }`}
    >
      {published ? <Check size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
      {published ? "Publicada" : "Borrador"}
    </span>
  );
}
