"use client";

import { CircleAlert, FileText, Upload, X } from "lucide-react";
import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { MAX_GUIDE_BYTES } from "@censaguias/shared";
import { formatBytes } from "@/lib/format";

export interface PdfDropzoneProps {
  /** Archivo seleccionado (controlado). */
  file?: File | null;
  /** Alias de `file`, para quien prefiera el patrón `value`. */
  value?: File | null;
  /** Se llama con el archivo válido o con `null` al quitarlo. */
  onChange?: (file: File | null) => void;
  /** Alias de `onChange`. */
  onFileChange?: (file: File | null) => void;
  /** Deshabilita la zona (p. ej. mientras se sube). */
  disabled?: boolean;
  /** Error externo (p. ej. «Selecciona un archivo PDF» al enviar). */
  error?: string | null;
  /** Etiqueta visible de la zona. */
  label?: string;
  /** Ayuda adicional bajo la zona. */
  hint?: string;
  /** id del input oculto, para asociar etiquetas externas. */
  id?: string;
  /** Texto del botón del estado vacío (Figma «Seleccionar PDF»). */
  selectLabel?: string;
  /** Texto del botón para cambiar el archivo ya elegido. */
  replaceLabel?: string;
  /** Texto del botón para quitar el archivo elegido. */
  removeLabel?: string;
}

/**
 * Zona reutilizable para elegir un PDF (Figma `profesor-03` y `profesor-04`):
 * clic, teclado (Enter/Espacio) y arrastre. Valida tipo PDF y tamaño (≤ 10 MB),
 * enseña nombre y tamaño y permite quitarlo o reemplazarlo. El error se pinta
 * junto a la zona con `role="alert"` y se enlaza con `aria-describedby` (WEB-08e).
 */
export function PdfDropzone({
  file,
  value,
  onChange,
  onFileChange,
  disabled = false,
  error: externalError,
  label = "Guía en PDF *",
  hint,
  id,
  selectLabel = "Seleccionar PDF",
  replaceLabel = "Reemplazar",
  removeLabel = "Quitar",
}: PdfDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const generatedId = useId();
  const baseId = id ?? generatedId;
  const labelId = `${baseId}-label`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  const selected = file ?? value ?? null;
  const error = internalError ?? externalError ?? null;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  function notify(next: File | null) {
    onChange?.(next);
    onFileChange?.(next);
  }

  function validarYNotificar(candidate: File | null) {
    setInternalError(null);
    if (!candidate) {
      notify(null);
      return;
    }
    const esPdf = candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf");
    if (!esPdf) {
      setInternalError("Solo se admiten archivos PDF.");
      notify(null);
      return;
    }
    if (candidate.size > MAX_GUIDE_BYTES) {
      setInternalError("El PDF supera el límite de 10 MB. Reduce el tamaño e inténtalo de nuevo.");
      notify(null);
      return;
    }
    if (candidate.size === 0) {
      setInternalError("El archivo está vacío.");
      notify(null);
      return;
    }
    notify(candidate);
  }

  function abrirSelector() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    validarYNotificar(event.target.files?.[0] ?? null);
    // Permite volver a elegir el mismo archivo después de quitarlo.
    event.target.value = "";
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    validarYNotificar(event.dataTransfer.files?.[0] ?? null);
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      abrirSelector();
    }
  }

  function quitar(event?: MouseEvent) {
    event?.stopPropagation();
    if (disabled) return;
    setInternalError(null);
    notify(null);
  }

  const border = dragging
    ? "border-2 border-primary bg-tint"
    : error
      ? "border-2 border-primary"
      : "border-line";

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-label font-semibold text-ink">
        {label}
      </span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".pdf,application/pdf"
        onChange={onInputChange}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {selected ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-card border bg-surface p-4 ${border}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <FileText size={22} className="shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-ink">{selected.name}</p>
              <p className="text-meta text-muted">
                {formatBytes(selected.size)} · PDF adjunto correctamente
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={abrirSelector}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy || undefined}
              className="inline-flex min-h-[44px] items-center rounded-control border border-line bg-surface px-3 text-label font-semibold text-ink outline-none focus:border-2 focus:border-primary disabled:opacity-50"
            >
              {replaceLabel}
            </button>
            <button
              type="button"
              onClick={quitar}
              disabled={disabled}
              aria-label={removeLabel}
              className="inline-flex min-h-[44px] items-center rounded-control border border-line bg-surface px-3 text-label font-semibold text-ink outline-none focus:border-2 focus:border-primary disabled:opacity-50"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={abrirSelector}
          onKeyDown={onKey}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          aria-disabled={disabled ? true : undefined}
          aria-labelledby={labelId}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          className={`flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed bg-surface p-6 text-center outline-none focus:border-2 focus:border-primary ${border} ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <Upload size={26} className="text-primary" aria-hidden />
          <p className="text-body font-semibold text-ink">Arrastra un PDF o selecciona un archivo</p>
          <p className="text-meta text-muted">Solo PDF · Máximo 10 MB</p>
          <span
            className="mt-1 inline-flex min-h-[44px] items-center rounded-control border border-primary px-4 text-label font-semibold text-primary"
            aria-hidden
          >
            {selectLabel}
          </span>
        </div>
      )}

      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex items-start gap-2 rounded-card border border-line bg-tint p-3 text-label text-ink"
        >
          <CircleAlert size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {hint && <p id={hintId} className="text-meta text-muted">{hint}</p>}
    </div>
  );
}

export default PdfDropzone;
