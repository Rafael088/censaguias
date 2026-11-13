"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState, type FormEvent } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Select } from "@/components/select";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { deleteGuide, getGuide, publishGuide, replaceGuidePdf, updateGuide, type TeacherGuide } from "@/lib/teacher";

/** Editar una guía (Figma `profesor-04` y `profesor-05`): editar título/tema/descripción,
 *  reemplazar el PDF, publicar y eliminar con confirmación. No se ofrece despublicar.
 */
export default function EditarGuía({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();

  const { id: guideId } = use(params);

  const [guide, setGuide] = useState<TeacherGuide | null>(null);
  const [fallo, setFallo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [intento, setIntento] = useState(0);

  // Edición de datos
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [erroresEdicion, setErroresEdicion] = useState<{ topic?: string; title?: string; description?: string }>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Reemplazar PDF
  const [nuevoPdf, setNuevoPdf] = useState<File | null>(null);
  const [nuevoPdfName, setNuevoPdfName] = useState("");
  const [reemplazando, setReemplazando] = useState(false);

  // Publicar / despublicar
  const [publicando, setPublicando] = useState(false);

  // Eliminar
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setActualizando(true);
    getGuide(guideId)
      .then((data) => {
        if (cancelled) return;
        setGuide(data);
        setTopic(data.topic);
        setTitle(data.title);
        setDescription(data.description);
        setFallo(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-07] No se pudo cargar la guía:", error);
        setFallo(true);
      })
      .finally(() => {
        if (!cancelled) setActualizando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [guideId, intento]);

  if (fallo) {
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar la guía.</ErrorScreen>;
  }
  if (!guide || actualizando) return <LoadingScreen text="Cargando la guía…" />;

  async function guardarDatos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const t = topic.trim();
    const ti = title.trim();
    const d = description.trim();

    const errores: { topic?: string; title?: string; description?: string } = {};
    if (!t) errores.topic = "Escribe el tema.";
    if (!ti) errores.title = "Escribe el título.";
    if (!d) errores.description = "Escribe una descripción.";
    setErroresEdicion(errores);
    setErrorApi(null);
    if (errores.topic || errores.title || errores.description) return;

    setGuardando(true);
    try {
      const actualizada = await updateGuide(guideId, { topic: t, title: ti, description: d });
      setGuide(actualizada);
      setTopic(actualizada.topic);
      setTitle(actualizada.title);
      setDescription(actualizada.description);
      setErrorApi(null);
    } catch (err) {
      console.warn("[WEB-07] No se pudo editar la guía:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos editar la guía.");
    } finally {
      setGuardando(false);
    }
  }

  async function reemplazarPdf() {
    if (!nuevoPdf) return;
    const form = new FormData();
    form.append("file", nuevoPdf);
    setReemplazando(true);
    setErrorApi(null);
    try {
      const actualizada = await replaceGuidePdf(guideId, form);
      setGuide(actualizada);
      setNuevoPdf(null);
      setNuevoPdfName("");
    } catch (err) {
      console.warn("[WEB-07] No se pudo reemplazar el PDF:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos reemplazar el PDF.");
    } finally {
      setReemplazando(false);
    }
  }

  async function publicar() {
    setPublicando(true);
    setErrorApi(null);
    try {
      const actualizada = await publishGuide(guideId);
      setGuide(actualizada);
    } catch (err) {
      console.warn("[WEB-07] No se pudo publicar la guía:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos publicar la guía.");
    } finally {
      setPublicando(false);
    }
  }

  async function eliminar() {
    const g = guide;
    if (!g) return;
    if (!window.confirm(`¿Eliminar la guía "${g.title}"? Se borrará también su archivo PDF.`)) return;
    setEliminando(true);
    setErrorApi(null);
    try {
      await deleteGuide(guideId);
      router.push("/profesor");
    } catch (err) {
      console.warn("[WEB-07] No se pudo eliminar la guía:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos eliminar la guía.");
    } finally {
      setEliminando(false);
    }
  }

  const estadoTexto = guide.status === "published" ? "Publicada" : "Borrador";
  const estadoClase =
    guide.status === "published" ? "bg-tint text-ink" : "bg-primary text-white";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Breadcrumb items={[
        { label: "Tus materias", href: "/profesor" },
        { label: "Guías", href: `/profesor/materias/${guide.subjectId}` },
        { label: guide.title },
      ]} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-section font-semibold text-ink">Editar guía</h1>
          <p className="text-body text-muted">{guide.topic} · {guide.fileName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex min-h-8 items-center gap-1 rounded-control px-2 py-0.5 text-meta font-semibold ${estadoClase}`}
          >
            {estadoTexto}
          </span>
        </div>
      </header>

      {errorApi && (
        <Notice tone="error" title="No se pudo guardar">
          {errorApi}
        </Notice>
      )}

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <h2 className="text-body font-semibold text-ink">Datos de la guía</h2>
        <form onSubmit={(event) => void guardarDatos(event)} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tema *"
              placeholder="Ej. Ecuaciones diferenciales"
              value={topic}
              error={erroresEdicion.topic}
              onChange={(event) => setTopic(event.target.value)}
            />
            <Field
              label="Título *"
              placeholder="Ej. Guía 1: introducción"
              value={title}
              error={erroresEdicion.title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-label font-semibold text-ink">Descripción *</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Qué cubre esta guía y para qué sirve"
              className={`min-h-[100px] w-full rounded-control border bg-surface px-3 py-3 text-body text-ink outline-none focus:border-2 focus:border-primary resize-none ${erroresEdicion.description ? "border-2 border-primary" : "border-line"}`}
            />
            {erroresEdicion.description && (
              <div className="flex items-start gap-2 rounded-card border border-line bg-tint p-3 text-label text-ink">
                <span>{erroresEdicion.description}</span>
              </div>
            )}
          </div>
          <p className="text-meta text-muted">* Campos obligatorios</p>
          <div className="flex justify-end">
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar datos"}
            </Button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <h2 className="text-body font-semibold text-ink">Archivo PDF</h2>
        <div className="flex flex-col gap-1.5">
          <label className="text-label font-semibold text-ink">Archivo PDF actual</label>
          <div className="flex items-center gap-2">
            <span className="text-meta text-muted">{guide.fileName}</span>
            <span className="text-meta text-muted">({Math.round(guide.sizeBytes / 1024)} KB)</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="archivo-pdf-reemplazo" className="text-label font-semibold text-ink">
              Reemplazar PDF
            </label>
            <input
              id="archivo-pdf-reemplazo"
              type="file"
              accept=".pdf"
              onChange={(event) => {
                const f = event.target.files?.[0] ?? null;
                setNuevoPdf(f);
                setNuevoPdfName(f ? f.name : "");
              }}
              className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-ink outline-none focus:border-2 focus:border-primary"
            />
            {nuevoPdf && (
              <div className="flex items-center gap-2">
                <span className="text-meta text-muted">{nuevoPdfName}</span>
                <span className="text-meta text-muted">({Math.round(nuevoPdf.size / 1024)} KB)</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" disabled={reemplazando || !nuevoPdf} onClick={() => setNuevoPdf(null)}>
              Limpiar
            </Button>
            <Button onClick={() => void reemplazarPdf()} disabled={reemplazando || !nuevoPdf}>
              {reemplazando ? "Reemplazando…" : "Reemplazar PDF"}
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-body font-semibold text-ink">Estado de publicación</h2>
            <p className="text-meta text-muted">
              Los estudiantes solo ven las guías publicadas.
            </p>
          </div>
          <Button
            onClick={() => void publicar()}
            disabled={publicando || guide.status === "published"}
          >
            {publicando ? "Publicando…" : "Publicar guía"}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <h2 className="text-body font-semibold text-ink">Eliminar guía</h2>
        <p className="text-meta text-muted">
          Esta acción borra la guía y su archivo PDF. No se puede deshacer.
        </p>
        <div>
          <Button variant="secondary" onClick={() => void eliminar()} disabled={eliminando}>
            {eliminando ? "Eliminando…" : "Eliminar guía"}
          </Button>
        </div>
      </section>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => router.back()}>
          Volver a las guías
        </Button>
      </div>
    </div>
  );
}
