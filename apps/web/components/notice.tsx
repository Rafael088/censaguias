import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type NoticeTone = "info" | "success" | "error";

const tones: Record<NoticeTone, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border border-line bg-tint" },
  success: { icon: CircleCheck, className: "border border-line bg-tint" },
  // Figma: un error lleva icono «!» y borde de 2 px; nunca rojos.
  error: { icon: CircleAlert, className: "border-2 border-primary bg-tint" },
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}

/**
 * Aviso informativo, éxito o error (Figma: fondo tinte, icono, título y texto).
 *
 * Anuncios (WEB-08d, issue #42): el error es urgente y se anuncia solo
 * (`role="alert"`), la confirmación espera su turno sin mover el foco
 * (`role="status"`) y el informativo no interrumpe: sin región viva, que es lo
 * que se pinta estático con la página. El rol anuncia cuando el aviso aparece o
 * cambia, no al cargar.
 */
const anuncios: Record<NoticeTone, "alert" | "status" | undefined> = {
  info: undefined,
  success: "status",
  error: "alert",
};

export function Notice({ tone = "info", title, children, className = "" }: NoticeProps) {
  const { icon: Icon, className: toneClass } = tones[tone];
  return (
    <div role={anuncios[tone]} className={`flex items-start gap-3 rounded-card p-4 ${toneClass} ${className}`}>
      <Icon size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <div className="flex flex-col gap-1">
        {title && <p className="text-label font-semibold text-ink">{title}</p>}
        {children && <div className="text-meta text-ink">{children}</div>}
      </div>
    </div>
  );
}
