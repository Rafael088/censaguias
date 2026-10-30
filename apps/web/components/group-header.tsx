"use client";

import { Layers } from "lucide-react";
import { CodeChip } from "@/components/code-chip";

export interface GroupHeaderProps {
  /** «CLEI IV · A» */
  name: string;
  /** «Mañana» */
  journey: string;
  year: number | string;
  /** «CENSA-4AM-26» */
  code?: string;
}

/** Cabecera de grupo (Figma): icono, nombre, jornada · año lectivo y chip con el código para copiar. */
export function GroupHeader({ name, journey, year, code }: GroupHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-surface p-6">
      <div className="flex items-center gap-4">
        <span className="grid h-11 w-11 place-items-center rounded-control bg-tint text-primary">
          <Layers size={22} aria-hidden />
        </span>
        <div>
          <h2 className="text-body font-semibold text-ink">{name}</h2>
          <p className="text-meta text-muted">
            {journey} · Año lectivo {year}
          </p>
        </div>
      </div>
      {code && <CodeChip code={code} />}
    </header>
  );
}
