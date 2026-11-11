"use client";

import { RefreshCw, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";

/** Estado de carga de una pantalla (WEB-08): spinner animado, texto centrado
 *  y área mínima para que no salte el layout al aparecer. */
export function LoadingScreen({ text = "Cargando…" }: { text?: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-body text-muted">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-tint text-primary animate-pulse">
        <Loader2 size={20} className="animate-spin" aria-hidden />
      </div>
      <p role="status" aria-live="polite">{text}</p>
    </div>
  );
}

/** Estado de error: icono «!», borde de 2 px, título, texto y botón de reintentar
 *  (nunca solo color; siempre icono + texto + borde). */
export function ErrorScreen({
  title = "No pudimos cargar la información",
  children,
  onRetry,
}: {
  title?: string;
  children?: React.ReactNode;
  onRetry?: () => void;
}) {
  const [intentos, setIntentos] = useState(0);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-10 text-center">
      <Notice tone="error" title={title} className="mx-auto max-w-md">
        {children ?? "Revisa tu conexión e inténtalo de nuevo en unos minutos."}
      </Notice>
      {onRetry && (
        <Button
          variant="secondary"
          onClick={() => {
            setIntentos((n) => n + 1);
            onRetry();
          }}
          className="self-center min-w-[46px]"
        >
          <RefreshCw size={18} aria-hidden />
          {intentos > 0 ? "Volver a intentar" : "Intentar de nuevo"}
        </Button>
      )}
    </div>
  );
}
