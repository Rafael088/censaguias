"use client";

import { Download, ExternalLink } from "lucide-react";
import { use, useEffect, useState } from "react";
import { Breadcrumb, MobileBack } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { PdfPreview } from "@/components/pdf-preview";
import { StatusChip } from "@/components/status-chip";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { formatBytes, formatDate } from "@/lib/format";
import { abrirGuia, descargarGuia, urlDeGuia } from "@/lib/guide-file";
import { getStudentGuide, type StudentGuide, type StudentGroup } from "@/lib/student";
import { useStudent } from "../../student-shell";

type Guia = StudentGuide & { group: StudentGroup };

/** Detalle de guía (Figma «estudiante-03»): descripción, vista previa y panel con el archivo. */
export default function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { status: statusGrupo, reload } = useStudent();

  const [guide, setGuide] = useState<Guia | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "no-encontrada" | "error">("cargando");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setEstado("cargando");
    (async () => {
      const data = await getStudentGuide(id);
      if (cancelled) return;
      if (!data) {
        setEstado("no-encontrada");
        return;
      }
      const enlace = await urlDeGuia(id);
      if (cancelled) return;
      setGuide(data);
      setUrl(enlace);
      setEstado("listo");
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.warn("[WEB-02] No se pudo cargar la guía:", error);
      setEstado("error");
    });
    return () => {
      cancelled = true;
    };
  }, [id, intento]);

  if (statusGrupo === "error") return <ErrorScreen onRetry={reload}>No pudimos cargar tu grupo.</ErrorScreen>;
  if (statusGrupo === "cargando") return <LoadingScreen text="Cargando tu grupo…" />;

  if (estado === "cargando") return <LoadingScreen text="Cargando la guía…" />;
  if (estado === "error")
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar esta guía.</ErrorScreen>;

  if (estado === "no-encontrada" || !guide) {
    return (
      <div className="flex flex-col gap-4">
        <MobileBack href="/materias" />
        <EmptyState
          title="No encontramos esta guía"
          description="Puede que la haya borrado o dejado de publicarla tu docente."
          action={
            <Button variant="secondary" onClick={() => window.history.back()}>
              Volver
            </Button>
          }
        />
      </div>
    );
  }

  const { group, subject, topic, title, description, publishedAt, fileName, sizeBytes, pageCount, teacher } = guide;
  const parrafos = description.split("\n\n").filter(Boolean);
  const subjectHref = `/materias/${subject.id}`;

  return (
    <div className="flex flex-col gap-6">
      <MobileBack href={subjectHref} />
      <div className="flex flex-col gap-3">
        <Breadcrumb
          items={[
            { label: "Mis materias", href: "/materias" },
            { label: subject.name, href: subjectHref },
            { label: "Detalle de guía" },
          ]}
        />
        <header className="flex flex-col gap-1">
          <h1 className="text-[32px] font-semibold leading-tight text-ink">{title}</h1>
          <p className="text-body text-muted">
            {subject.name} / {group.label} / {group.shift}
          </p>
        </header>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Descripción: en móvil va primero y sin tarjeta; en escritorio ocupa la columna izquierda. */}
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6 lg:col-start-1 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-control bg-tint px-2.5 py-1 text-meta font-semibold uppercase text-ink">
              {topic}
            </span>
            <StatusChip status="published" />
          </div>
          <div className="flex flex-col gap-1 text-meta text-muted lg:hidden">
            {teacher && <p>Docente {teacher}</p>}
            <p>
              Publicado el {formatDate(publishedAt)} · PDF · {formatBytes(sizeBytes)}
            </p>
          </div>
          {parrafos.map((parrafo) => (
            <p key={parrafo} className="text-body text-ink">
              {parrafo}
            </p>
          ))}
        </section>

        {/* Material de estudio: las etiquetas solo existen en escritorio; los botones, en las dos. */}
        <aside className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <div className="hidden flex-col gap-4 lg:flex">
              <h2 className="text-body font-semibold text-ink">Tu material de estudio</h2>
              <dl className="flex flex-col gap-4">
                <div>
                  <dt className="text-meta font-semibold uppercase tracking-wide text-muted">Tema</dt>
                  <dd className="text-body text-ink">{topic}</dd>
                </div>
                <div>
                  <dt className="text-meta font-semibold uppercase tracking-wide text-muted">Docente</dt>
                  <dd className="text-body text-ink">{teacher ?? "Sin docente asignado"}</dd>
                </div>
                <div>
                  <dt className="text-meta font-semibold uppercase tracking-wide text-muted">Publicada el</dt>
                  <dd className="text-body text-ink">{formatDate(publishedAt)}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-col gap-3">
              <p className="break-all text-label font-semibold text-ink">{fileName}</p>
              <p className="text-meta text-muted">
                PDF · {formatBytes(sizeBytes)}
                {pageCount ? ` · ${pageCount} ${pageCount === 1 ? "página" : "páginas"}` : ""}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={() => void abrirGuia(guide.id)}>
                <ExternalLink size={18} aria-hidden />
                Abrir PDF
              </Button>
              <Button variant="secondary" onClick={() => void descargarGuia(guide.id)}>
                <Download size={18} aria-hidden />
                Descargar PDF
              </Button>
            </div>
          </div>

          <Notice tone="info" title="Lee la guía completa">
            La vista previa muestra la primera página. Abre el PDF para ver todos los ejemplos y las actividades.
          </Notice>
        </aside>

        {/* Vista previa: bajo la descripción en escritorio, al final en móvil. */}
        <div className="lg:col-start-1 lg:row-start-2">
          <PdfPreview url={url} pageCount={pageCount} />
        </div>
      </div>
    </div>
  );
}
