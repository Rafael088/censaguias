import { CircleAlert } from "lucide-react";
import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string | null;
}

/**
 * Campo con etiqueta, ayuda y error (Figma «CENSA / Campo»).
 * El error lleva icono «!», borde de 2 px y texto: nunca se comunica solo con color.
 */
export function Field({ label, hint, error, className = "", ...rest }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={`min-h-[46px] rounded-control border bg-surface px-3 text-body text-ink outline-none placeholder:text-muted focus:border-2 focus:border-primary ${error ? "border-2 border-primary" : "border-line"} ${className}`}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-meta text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-2 rounded-card border border-line bg-tint p-3 text-label text-ink"
        >
          <CircleAlert size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
