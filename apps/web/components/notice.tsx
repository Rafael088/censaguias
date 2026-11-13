import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type NoticeTone = "info" | "success" | "error";
type AriaLive = "assertive" | "polite" | undefined;

const tones: Record<NoticeTone, { icon: LucideIcon; className: string; ariaLive?: AriaLive }> = {
  info: { icon: Info, className: "border border-line bg-tint" },
  // Confirmaciones se anuncian con aria-live="polite" (no interrumpen al usuario).
  success: { icon: CircleCheck, className: "border border-line bg-tint", ariaLive: "polite" },
  // Errores se anuncian con role="alert" (anuncio inmediato e interrumpidor).
  error: { icon: CircleAlert, className: "border-2 border-primary bg-tint", ariaLive: "assertive" },
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
 * Accesibilidad (WEB-08d):
 * - «error»: role="alert" → se anuncia de inmediato (interrumpe).
 * - «success»: aria-live="polite" → se anuncia al terminar la tarea actual.
 * - «info»: sin región viva → aviso estático, no se anuncia automáticamente.
 */
export function Notice({ tone = "info", title, children, className = "" }: NoticeProps) {
  const { icon: Icon, className: toneClass, ariaLive } = tones[tone];
  return (
    <div
      className={`flex items-start gap-3 rounded-card p-4 ${toneClass} ${className}`}
      role={tone === "error" ? "alert" : undefined}
      aria-live={ariaLive}
      aria-relevant={tone === "error" ? "additions text" : undefined}
    >
      <Icon size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <div className="flex flex-col gap-1">
        {title && <p className="text-label font-semibold text-ink">{title}</p>}
        {children && <div className="text-meta text-ink">{children}</div>}
      </div>
    </div>
  );
}
