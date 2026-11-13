"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/** IDs estables para asociar el diálogo con su título y descripción. */
const useDialogIds = (title: string) => {
  const titleId = `dialog-title-${title.replace(/\s+/g, "-").toLowerCase()}`;
  const descId = `dialog-desc-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return { titleId, descId };
};

/**
 * Diálogo de confirmación accesible (Figma «Antes de continuar…»): panel de 16 px,
 * acciones abajo a la derecha y botón destructivo con el nombre del objeto
 * («Eliminar grupo»), no solo un color.
 *
 * Accesibilidad (WEB-08c):
 * - aria-labelledby apunta al título y aria-describedby a la descripción.
 * - Al abrir, el foco se mueve al diálogo.
 * - La tecla Tab contiene el foco dentro del diálogo (no sale al fondo).
 * - Al cerrar, el foco vuelve al elemento que lo activó.
 */
export function Dialog({ open, onClose, title, description, children, actions }: DialogProps) {
  const { titleId, descId } = useDialogIds(title);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      // Contener el foco con Tab dentro del diálogo.
      if (event.key === "Tab") {
        event.preventDefault();
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (!focusable || focusable.length === 0) return;
        const current = document.activeElement as HTMLElement | null;
        const currentIndex = Array.from(focusable).indexOf(current!);
        const nextIndex =
          event.shiftKey
            ? (currentIndex - 1 + focusable.length) % focusable.length
            : (currentIndex + 1) % focusable.length;
        focusable[nextIndex]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Al abrir: guardar el activador y enfocar el diálogo.
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      // Al cerrar: devolver el foco al activador.
      previousFocus.current?.focus?.();
      previousFocus.current = null;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-panel border border-line bg-surface p-5 outline-none"
        style={{ outline: "none" }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-muted outline-none hover:bg-tint hover:text-ink"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {description && <p id={descId} className="mt-2 text-meta text-muted">{description}</p>}
        {children && <div className="mt-4 text-label text-ink">{children}</div>}
        {actions && <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
