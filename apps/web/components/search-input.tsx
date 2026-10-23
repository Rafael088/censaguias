import { Search } from "lucide-react";
import { useId } from "react";
import type { InputHTMLAttributes } from "react";

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Se usa como etiqueta accesible (aria-label). */
  label?: string;
}

/** Buscador con icono lineal (Figma «Buscar por nombre o código»). */
export function SearchInput({ label = "Buscar", className = "", ...rest }: SearchInputProps) {
  const id = useId();
  return (
    <div className="relative w-full">
      <Search
        size={20}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        id={id}
        type="search"
        aria-label={label}
        className={`min-h-[46px] w-full rounded-control border border-line bg-surface pl-10 pr-3 text-body text-ink outline-none placeholder:text-muted focus:border-2 focus:border-primary ${className}`}
        {...rest}
      />
    </div>
  );
}
