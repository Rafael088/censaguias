import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
}

export interface SidebarAction {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
}

export interface SidebarProps {
  /** «Espacio estudiante» · «Espacio profesor» · «Administración» */
  space: string;
  items: SidebarItem[];
  /** Texto de ayuda bajo la navegación. */
  help?: string;
  action?: SidebarAction;
}

/**
 * Barra lateral por rol (Figma): 244 px, logo reservado, espacio con etiqueta,
 * navegación (activo en verde sólido) y acción al pie («Cambiar código» / «Cerrar sesión»).
 */
export function Sidebar({ space, items, help, action }: SidebarProps) {
  return (
    <aside className="flex h-dvh w-[244px] shrink-0 flex-col gap-6 border-r border-line bg-surface p-4">
      <div className="rounded-card border border-dashed border-line px-4 py-3 text-center">
        <p className="text-label font-semibold text-ink">Logo oficial de CENSA</p>
        <p className="text-meta text-muted">Espacio reservado</p>
      </div>
      <div>
        <p className="text-meta font-semibold uppercase tracking-wide text-muted">Plataforma educativa</p>
        <p className="text-body font-semibold text-ink">{space}</p>
      </div>
      <nav className="flex flex-col gap-2" aria-label="Principal">
        {items.map(({ label, href, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center gap-2 rounded-control px-3 text-label font-semibold outline-none ${
              active ? "bg-primary text-white" : "text-ink hover:bg-tint"
            }`}
          >
            <Icon size={20} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      {help && <p className="text-meta text-muted">{help}</p>}
      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-label font-semibold text-primary outline-none hover:bg-tint"
          >
            {action.icon && <action.icon size={18} aria-hidden />}
            {action.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-line bg-surface px-3 text-label font-semibold text-primary outline-none hover:bg-tint"
          >
            {action.icon && <action.icon size={18} aria-hidden />}
            {action.label}
          </button>
        ))}
    </aside>
  );
}
