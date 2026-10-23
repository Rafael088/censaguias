export interface TabOption {
  value: string;
  label: string;
}

export interface FilterTabsProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

/**
 * Filtro por pestañas (Figma «Todas · Publicada · Borrador · Mañana · Noche · Sabatina»):
 * pestaña activa en verde sólido sobre banda tinte.
 */
export function FilterTabs({ options, value, onChange, label = "Filtros" }: FilterTabsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2 rounded-control bg-tint p-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-11 rounded-control px-4 text-label font-semibold transition-colors ${
              active ? "bg-primary text-white" : "text-ink hover:bg-surface"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
