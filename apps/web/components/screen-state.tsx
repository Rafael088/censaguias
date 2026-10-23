"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";

/** Estado de carga de una pantalla (WEB-08 dará el pulido final). */
export function LoadingScreen({ text = "Cargando…" }: { text?: string }) {
  return (
    <p role="status" className="flex min-h-40 items-center justify-center text-body text-muted">
      {text}
    </p>
  );
}

/** Estado de error: icono «!», borde de 2 px y cómo reintentar (nunca solo color). */
export function ErrorScreen({
  title = "No pudimos cargar la información",
  children,
  onRetry,
}: {
  title?: string;
  children?: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-10">
      <Notice tone="error" title={title}>
        {children ?? "Revisa tu conexión e inténtalo de nuevo en unos minutos."}
      </Notice>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="self-start">
          <RefreshCw size={18} aria-hidden />
          Intentar de nuevo
        </Button>
      )}
    </div>
  );
}
