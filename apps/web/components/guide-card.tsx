import { FileText } from "lucide-react";
import type { ReactNode } from "react";

export interface GuideCardProps {
  topic: string;
  title: string;
  description?: string;
  /** «PDF · 1,8 MB · 14 oct 2026» */
  meta?: string;
  actions?: ReactNode;
}

/** Tarjeta de guía (Figma): chip de tema, título, descripción, archivo y acciones de texto. */
export function GuideCard({ topic, title, description, meta, actions }: GuideCardProps) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
      <span className="w-fit rounded-control bg-tint px-2.5 py-1 text-meta font-semibold text-ink">
        {topic}
      </span>
      <h3 className="text-body font-semibold text-ink">{title}</h3>
      {description && <p className="text-meta text-muted">{description}</p>}
      {meta && (
        <p className="flex items-center gap-2 text-meta text-muted">
          <FileText size={16} aria-hidden />
          {meta}
        </p>
      )}
      {actions && <div className="mt-1 flex flex-wrap items-center gap-4">{actions}</div>}
    </article>
  );
}
