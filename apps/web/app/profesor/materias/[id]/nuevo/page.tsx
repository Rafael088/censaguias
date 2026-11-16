"use client";

import { Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useId, useRef, useState, type FormEvent } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { createGuide, plural, validateGuideForm, type TeacherGuideFormValues } from "@/lib/teacher";

/** Subir una guía (Figma `profesor-03`): tema, título, descripción y el archivo PDF
 *  (máx. 10 MB), con dos salidas —Guardar borrador y Publicar guía— en lugar del
 *  selector de estado (WEB-07c). La que pulse el profesor es la que decide el
 *  estado final de la guía.
 */
export default function SubirGuía({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { id: subjectId } = use(params);
  const materiaName = searchParams.get("materiaName") || "";

  const topicRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();

  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [errores, setErrores] = useState<{ topic?: string; title?: string; description?: string; status?: string; file?: string }>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  /** Petición en marcha: `null` en reposo. Mientras hay una, los botones salen
   *  deshabilitados y el que la lanzó enseña su progreso. El corte real del doble
   *  envío está en `enviando`. */
  const [guardando, setGuardando] = useState<"draft" | "published" | null>(null);
  /** Estado en el que quedó la guía creada, para confirmárselo al profesor. */
  const [creada, setCreada] = useState<{ status: "draft" | "published"; titulo: string } | null>(null);
  /** Corte de doble envío que no depende del render: dos clics en el mismo instante
   *  no llegan a mandar dos guías. */
  const enviando = useRef(false);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando.current) return; // Bloqueo de doble envío, sin depender del render.

    // El estado final lo decide el botón pulsado. Si se envía con Enter desde un
    // campo (sin botón), se guarda como borrador: es lo que no ve nadie más.
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const estadoFinal: "draft" | "published" = submitter?.value === "published" ? "published" : "draft";

    const { errors, input } = validateGuideForm({ topic, title, description, status: estadoFinal });
    setErrores(errors);
    setErrorApi(null);
    if (!input) {
      // Enfocar el primer campo con error.
      if (errores.topic) topicRef.current?.focus();
      else if (errores.title) titleRef.current?.focus();
      else if (errores.description) descriptionRef.current?.focus();
      return;
    }

    if (!file) {
      setErrores({ ...errores, file: "Selecciona un archivo PDF." });
      fileRef.current?.focus();
      return;
    }

    const form = new FormData();
    form.append("topic", input.topic);
    form.append("title", input.title);
    form.append("description", input.description);
    form.append("status", input.status);
    form.append("file", file);

    enviando.current = true;
    setGuardando(estadoFinal);
    try {
      await createGuide(subjectId, form);
      setCreada({ status: estadoFinal, titulo: input.title });
    } catch (err) {
      console.warn("[WEB-07c] No se pudo subir la guía:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos subir la guía.");
    } finally {
      enviando.current = false;
      setGuardando(null);
    }
  }

  /** Vuelve a empezar de cero tras la confirmación («Subir otra guía»). */
  function reiniciar() {
    setTopic("");
    setTitle("");
    setDescription("");
    setFile(null);
    setFileName("");
    setErrores({});
    setErrorApi(null);
    setCreada(null);
  }

  /** Confirmación del estado final: en lugar de mandar a otra pantalla y perder el
   *  aviso, se queda aquí enseñando en qué ha quedado la guía.
   */
  if (creada) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Breadcrumb items={[
          { label: "Tus materias", href: "/profesor" },
          { label: materiaName || "Materia", href: `/profesor/materias/${subjectId}` },
          { label: "Subir guía" },
        ]} />

        <header className="flex flex-col gap-1">
          <h1 className="text-section font-semibold text-ink">Guía creada</h1>
        </header>

        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <Notice
            tone="success"
            title={creada.status === "published" ? "Guía publicada correctamente" : "Guardada como borrador"}
          >
            {creada.status === "published"
              ? `${creada.titulo} ya está disponible para tus estudiantes.`
              : `${creada.titulo} está guardada como borrador: solo tú la ves hasta que la publiques.`}
          </Notice>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={reiniciar}>
              Subir otra guía
            </Button>
            <Button onClick={() => router.push(`/profesor/materias/${subjectId}`)}>
              Ver las guías de la materia
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Breadcrumb items={[
        { label: "Tus materias", href: "/profesor" },
        { label: materiaName || "Materia", href: `/profesor/materias/${subjectId}` },
        { label: "Subir guía" },
      ]} />

      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">Subir guía</h1>
        <p className="text-body text-muted">
          Sube un PDF de máximo 10 MB. Puede guardarse como borrador o publicarse
          directamente para que los estudiantes la vean.
        </p>
      </header>

      <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="text-body font-semibold text-ink">Datos de la guía</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tema *"
              placeholder="Ej. Ecuaciones diferenciales"
              value={topic}
              error={errores.topic}
              onChange={(event) => setTopic(event.target.value)}
              ref={topicRef}
            />
            <Field
              label="Título *"
              placeholder="Ej. Guía 1: introducción"
              value={title}
              error={errores.title}
              onChange={(event) => setTitle(event.target.value)}
              ref={titleRef}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={descriptionId} className="text-label font-semibold text-ink">Descripción *</label>
            <textarea
              id={descriptionId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Qué cubre esta guía y para qué sirve"
              ref={descriptionRef}
              aria-describedby={errores.description ? `${descriptionId}-error` : undefined}
              aria-invalid={errores.description ? true : undefined}
              className={`min-h-[100px] w-full rounded-control border bg-surface px-3 py-3 text-body text-ink outline-none focus:border-2 focus:border-primary resize-none ${errores.description ? "border-2 border-primary" : "border-line"}`}
            />
            {errores.description && (
              <div id={`${descriptionId}-error`} role="alert" className="flex items-start gap-2 rounded-card border border-line bg-tint p-3 text-label text-ink">
                <span>{errores.description}</span>
              </div>
            )}
          </div>
          <p className="text-meta text-muted">* Campos obligatorios</p>
        </section>

        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="text-body font-semibold text-ink">Archivo PDF</h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="archivo-pdf" className="text-label font-semibold text-ink">
              Archivo PDF *
            </label>
            <input
              id="archivo-pdf"
              ref={fileRef}
              type="file"
              accept=".pdf"
              aria-describedby={errores.file ? "archivo-error" : undefined}
              aria-invalid={errores.file ? true : undefined}
              onChange={(event) => {
                const f = event.target.files?.[0] ?? null;
                setFile(f);
                setFileName(f ? f.name : "");
              }}
              className={`min-h-[46px] w-full rounded-control border bg-surface px-3 text-body text-ink outline-none focus:border-2 focus:border-primary ${errores.file ? "border-2 border-primary" : "border-line"}`}
            />
            {errores.file && (
              <div id="archivo-error" role="alert" className="flex items-start gap-2 rounded-card border border-line bg-tint p-3 text-label text-ink">
                <span>{errores.file}</span>
              </div>
            )}
            {file && (
              <div className="flex items-center gap-2">
                <span className="text-meta text-muted">{fileName}</span>
                <span className="text-meta text-muted">({Math.round(file.size / 1024)} KB)</span>
              </div>
            )}
            <p className="text-meta text-muted">
              Máximo 10 MB. Solo archivos PDF. El nombre del archivo se conserva en la guía.
            </p>
          </div>
          {errorApi && (
            <Notice tone="error" title="No pudimos subir la guía">
              {errorApi}
            </Notice>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="text" type="button" disabled={guardando !== null} onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button variant="secondary" type="submit" value="draft" disabled={guardando !== null || !file}>
              {guardando === "draft" ? "Guardando…" : "Guardar borrador"}
            </Button>
            <Button type="submit" value="published" disabled={guardando !== null || !file}>
              <Send size={18} aria-hidden />
              {guardando === "published" ? "Publicando…" : "Publicar guía"}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
