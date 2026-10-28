import { CircleAlert } from "lucide-react";
import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Ayuda bajo el campo; se oculta cuando hay error (Figma). */
  hint?: ReactNode;
  /** Mensaje de error; suelta el campo con borde de 2 px, el «!» dentro y la caja de aviso. */
  error?: string | null;
  /** Borde de 2 px e icono «!» dentro del campo, sin mensaje (Figma «acceso-staff-error»). */
  invalid?: boolean;
  /** Primera línea en negrita de esa caja (Figma «No pudimos encontrar tu grupo»). */
  errorTitle?: ReactNode;
}

/**
 * Campo con etiqueta, ayuda y error (Figma «CENSA / Campo»).
 * El error lleva icono «!», borde de 2 px y texto: nunca se comunica solo con color.
 */
export function Field({ label, hint, error, invalid, errorTitle, className = "", ...rest }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const marked = Boolean(error) || invalid;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={marked ? true : undefined}
          className={`min-h-[46px] w-full rounded-control border bg-surface px-3 text-body text-ink outline-none placeholder:text-muted focus:border-2 focus:border-primary ${marked ? "border-2 border-primary pr-11" : "border-line"} ${className}`}
          {...rest}
        />
        {marked && (
          <CircleAlert size={20} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-primary" aria-hidden />
        )}
      </div>
      {hint && (
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
          <span>
            {errorTitle && <strong className="block font-semibold">{errorTitle}</strong>}
            {error}
          </span>
        </div>
      )}
    </div>
  );
}
