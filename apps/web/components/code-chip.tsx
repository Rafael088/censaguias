"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export interface CodeChipProps {
  /** «CENSA-4AM-K7Q» */
  code: string;
  className?: string;
}

/**
 * Chip con el código de acceso para copiarlo (Figma «Código único»): al pulsarlo
 * pasa a «✓ Copiado» dos segundos. El código siempre queda a la vista, por si el
 * portapapeles no está disponible y hay que copiarlo a mano.
 */
export function CodeChip({ code, className = "" }: CodeChipProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso del portapapeles: el código se queda visible para copiarlo a mano.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Código copiado" : `Copiar código ${code}`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 text-label font-semibold text-ink outline-none hover:bg-tint ${className}`}
    >
      {copied ? (
        <Check size={16} className="text-primary" aria-hidden />
      ) : (
        <Copy size={16} className="text-muted" aria-hidden />
      )}
      {code}
    </button>
  );
}
