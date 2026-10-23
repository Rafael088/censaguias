import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  /** Del raíz al actual; el último no lleva enlace. */
  items: Crumb[];
}

const arrow = "shrink-0 text-primary";

/**
 * Migas de pan del Figma («← Mis materias / Matemáticas»), solo en escritorio.
 * En móvil la misma vuelta se muestra con `MobileBack`, que es lo que dibuja el Figma a 390 px.
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Ruta" className="hidden items-center gap-2 text-meta md:flex">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        const separator = index > 0 ? <span className="text-muted" aria-hidden>/</span> : null;
        const content =
          index === 0 ? (
            <>
              <ArrowLeft size={16} className={arrow} aria-hidden />
              {item.label}
            </>
          ) : (
            item.label
          );
        return (
          <span key={item.label} className="flex items-center gap-2">
            {separator}
            {item.href && !last ? (
              <Link href={item.href} className="text-muted outline-none hover:text-primary focus-visible:text-primary">
                {content}
              </Link>
        ) : (
              <span className="text-muted">{content}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/** Vuelta de 390 px (Figma «← Volver»): un solo enlace, sin migas. */
export function MobileBack({ href, label = "Volver" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex min-h-11 items-center gap-2 text-label font-semibold text-ink outline-none hover:text-primary md:hidden"
    >
      <ArrowLeft size={20} className={arrow} aria-hidden />
      {label}
    </Link>
  );
}
