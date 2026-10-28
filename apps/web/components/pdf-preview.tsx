"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { Notice } from "@/components/notice";

// El worker se sirve desde el propio paquete (Next lo empaqueta como asset).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface PdfPreviewProps {
  /** URL firmada (o archivo de muestra) del PDF. */
  url: string | null;
  /** Nº de páginas que informa la API; la real del archivo manda. */
  pageCount?: number | null;
}

/**
 * Vista previa del PDF (Figma «VISTA PREVIA · PDF · 1 / 4»): primera página
 * dibujada en un lienzo con pdfjs-dist, dentro de una hoja blanca sobre panel tinte.
 * Solo enseña la primera página: el resto se ve abriendo el PDF completo.
 */
export function PdfPreview({ url, pageCount }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pages, setPages] = useState<number | null>(pageCount ?? null);
  const [status, setStatus] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => {
    if (!url) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;

    async function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setStatus("cargando");
      try {
        task = pdfjs.getDocument({ url: url as string });
        const doc = await task.promise;
        const page = await doc.getPage(1);
        if (cancelled || !canvasRef.current) return;

        const base = page.getViewport({ scale: 1 });
        const available = canvasRef.current.clientWidth || 480;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (available / base.width) * dpr;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({
          canvas,
          canvasContext: canvas.getContext("2d")!,
          viewport,
        }).promise;

        if (cancelled) return;
        setPages(doc.numPages);
        setStatus("listo");
      } catch (error) {
        if (cancelled) return;
        console.warn("[WEB-02] No se pudo pintar la vista previa del PDF:", error);
        setStatus("error");
      }
    }

    void draw();
    return () => {
      cancelled = true;
      void task?.destroy().catch(() => undefined);
    };
  }, [url]);

  return (
    <section className="rounded-panel border border-line bg-tint p-4 md:p-6" aria-label="Vista previa del PDF">
      <header className="mb-4 flex items-center justify-between gap-4">
        <p className="text-meta font-semibold uppercase tracking-wide text-muted">Vista previa · PDF</p>
        <p className="text-meta text-muted" aria-live="polite">
          {status === "listo" && pages ? `1 / ${pages}` : pageCount ? `1 / ${pageCount}` : ""}
        </p>
      </header>

      {status === "error" ? (
        <Notice tone="info" title="La vista previa no está disponible">
          Abre el PDF para ver la guía completa.
        </Notice>
      ) : (
        <div className="mx-auto max-w-[560px] rounded-control border border-line bg-surface p-3">
          {status === "cargando" && (
            <p className="flex min-h-40 items-center justify-center text-meta text-muted">Cargando vista previa…</p>
          )}
          <canvas ref={canvasRef} className="block h-auto w-full" role="img" aria-label="Primera página de la guía" />
        </div>
      )}
    </section>
  );
}
