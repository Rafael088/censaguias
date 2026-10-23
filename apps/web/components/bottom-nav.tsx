import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
}

export interface BottomNavProps {
  items: BottomNavItem[];
  /** Fijo al pie de la pantalla (como en el móvil real); en la página de componentes se pasa `false`. */
  fixed?: boolean;
  className?: string;
}

/**
 * Navegación inferior en móvil (Figma «Materias · Mi grupo»): una columna,
 * objetivos táctiles de 44 px y activo en verde con etiqueta visible.
 */
export function BottomNav({ items, fixed = true, className = "" }: BottomNavProps) {
  return (
    <nav
      aria-label="Principal"
      className={`${fixed ? "fixed inset-x-0 bottom-0 z-40" : ""} grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden ${className}`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map(({ label, href, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-16 flex-col items-center justify-center gap-1 text-meta font-semibold outline-none ${
            active ? "text-primary" : "text-muted"
          }`}
        >
          <Icon size={22} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
