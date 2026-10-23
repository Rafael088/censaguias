import { ChevronDown } from "lucide-react";
import { useId } from "react";
import type { SelectHTMLAttributes } from "react";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  hint?: string;
}

/** Selector con etiqueta y ayuda (Figma «CENSA / Selector / Jornada»). */
export function Select({ label, hint, className = "", children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`min-h-[46px] w-full appearance-none rounded-control border border-line bg-surface px-3 pr-10 text-body text-ink outline-none focus:border-2 focus:border-primary ${className}`}
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
      {hint && (
        <p id={`${id}-hint`} className="text-meta text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
