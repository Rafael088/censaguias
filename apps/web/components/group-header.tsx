"use client";

import { Check, Copy, Layers } from "lucide-react";
import { useState } from "react";

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
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
      {code && (
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Código copiado" : `Copiar código ${code}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-label font-semibold text-ink outline-none hover:bg-tint"
        >
          {copied ? (
            <Check size={16} className="text-primary" aria-hidden />
          ) : (
            <Copy size={16} className="text-muted" aria-hidden />
          )}
          {code}
        </button>
      )}
    </header>
  );
}
