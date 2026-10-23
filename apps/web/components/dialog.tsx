"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/**
 * Diálogo de confirmación (Figma «Antes de continuar…»): panel de 16 px,
 * acciones abajo a la derecha y botón destructivo con el nombre del objeto
 * («Eliminar grupo»), no solo un color.
 */
export function Dialog({ open, onClose, title, description, children, actions }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-panel border border-line bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-muted outline-none hover:bg-tint hover:text-ink"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {description && <p className="mt-2 text-meta text-muted">{description}</p>}
        {children && <div className="mt-4 text-label text-ink">{children}</div>}
        {actions && <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
