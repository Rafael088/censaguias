import { ArrowRight, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export interface SubjectCardProps {
  name: string;
  description?: string;
  teacher?: string;
  guideCount: number;
  href: string;
  icon?: LucideIcon;
}

/**
 * Tarjeta de materia (Figma «estudiante-01»): icono en círculo tinte, nombre,
 * descripción, docente, nº de guías publicadas y flecha.
 */
export function SubjectCard({
  name,
  description,
  teacher,
  guideCount,
  href,
  icon: Icon = BookOpen,
}: SubjectCardProps) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 outline-none transition-colors hover:border-primary focus-visible:border-2 focus-visible:border-primary"
    >
      <span className="grid h-11 w-11 place-items-center rounded-control bg-tint text-primary">
        <Icon size={22} aria-hidden />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-semibold text-ink">{name}</h3>
        {description && <p className="text-meta text-muted">{description}</p>}
        {teacher && <p className="text-meta text-muted">Docente: {teacher}</p>}
      </div>
      <div className="mt-auto flex items-center justify-between">
        <span className="text-label font-semibold text-ink">
          {guideCount} {guideCount === 1 ? "guía publicada" : "guías publicadas"}
        </span>
        <ArrowRight size={20} className="text-primary" aria-hidden />
      </div>
    </Link>
  );
}
