import { FileQuestion } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

/** Estado vacío (Figma «Esta materia todavía no tiene guías»): icono en círculo,
 *  título, texto y botón. Responsivo: se apila en móvil y se centra en escritorio. */
export function EmptyState({ title, description, action, icon: Icon = FileQuestion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-line bg-surface px-6 py-12 sm:px-10 sm:py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-tint text-primary">
        <Icon size={28} aria-hidden />
      </span>
      <p className="text-body font-semibold text-ink">{title}</p>
      {description && (
        <p className="max-w-sm text-meta text-muted">{description}</p>
      )}
      {action && (
        <div className="mt-2 w-full sm:w-auto">{action}</div>
      )}
    </div>
  );
}
