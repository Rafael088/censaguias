"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
}

/** Lo que puede recibir el foco dentro del panel: con esto se cierra el ciclo de Tab. */
const FOCOABLES = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Diálogo de confirmación (Figma «Antes de continuar…»): panel de 16 px,
 * acciones abajo a la derecha y botón destructivo con el nombre del objeto
 * («Eliminar grupo»), no solo un color.
 *
 * Accesibilidad (WEB-08c, issue #39): el título y la descripción se enlazan con
 * IDs propios del diálogo, el foco entra al abrirlo y se queda dentro con Tab y
 * Shift+Tab; al cerrar vuelve al control que lo abrió. Escape y el clic en el
 * fondo siguen cerrándolo.
 */
export function Dialog({ open, onClose, title, description, children, actions }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const descripcionId = useId();
  // `onClose` cambia de identidad en cada render de quien lo usa: se guarda en un
  // ref para que el efecto del foco solo dependa de `open`. Con `[open, onClose]`
  // el efecto se reharía al re-renderizar el diálogo (p. ej. al pulsar «Eliminar»)
  // y robaría el foco al activador en mitad de la operación.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const activador = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // El foco entra al panel, que lleva el título y la descripción: así el lector
    // de pantalla los anuncia al abrir.
    panelRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focoables = Array.from(panel.querySelectorAll<HTMLElement>(FOCOABLES));
      const primero = focoables[0];
      const ultimo = focoables[focoables.length - 1];
      if (!primero || !ultimo) {
        // Dentro no hay nada que enfocar: el foco se queda en el panel.
        event.preventDefault();
        panel.focus();
        return;
      }
      const actual = document.activeElement;
      const indice = actual instanceof HTMLElement ? focoables.indexOf(actual) : -1;
      if (event.shiftKey) {
        if (indice <= 0) {
          event.preventDefault();
          ultimo.focus();
        }
      } else if (indice === -1 || indice === focoables.length - 1) {
        event.preventDefault();
        primero.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // El foco vuelve al que abrió el diálogo, si sigue en la página.
      if (activador && activador !== document.body && activador.isConnected) activador.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={description ? descripcionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-panel border border-line bg-surface p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={tituloId} className="text-xl font-semibold text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-muted outline-none hover:bg-tint hover:text-ink"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {description && <p id={descripcionId} className="mt-2 text-meta text-muted">{description}</p>}
        {children && <div className="mt-4 text-label text-ink">{children}</div>}
        {actions && <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}
