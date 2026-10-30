import { ChevronDown, CircleAlert } from "lucide-react";
import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  hint?: string;
  /** Mismo tratamiento que en Field (Figma): borde de 2 px, icono «!» y caja de aviso. */
  error?: string | null;
}

/** Selector con etiqueta, ayuda y error (Figma «CENSA / Selector / Jornada»). */
export function Select({ label, hint, error, className = "", children, ...rest }: SelectProps) {
  const id = useId();
  // El error sustituye a la ayuda: las dos juntas solo ensucian el campo.
  const hintId = hint && !error ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`min-h-[46px] w-full appearance-none rounded-control bg-surface px-3 pr-10 text-body text-ink outline-none focus:border-2 focus:border-primary ${
            error ? "border-2 border-primary" : "border-line"
          } ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={20}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="text-meta text-muted">
          {hint}
        </p>
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
    </div>
  );
}
