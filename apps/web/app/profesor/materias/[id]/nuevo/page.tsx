"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { createGuide, getTeacherOverview, validateGuideForm, type TeacherSubject } from "@/lib/teacher";

/** Subir una guía (Figma `profesor-03`): destino con datos reales, tema, título,
 *  descripción y el archivo PDF (máx. 10 MB), con dos salidas —Guardar borrador y
 *  Publicar guía— en lugar del selector de estado (WEB-07c). La que pulse el
 *  profesor es la que decide el estado final de la guía.
 */
export default function SubirGuía({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();

  const { id: subjectId } = use(params);

  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [errores, setErrores] = useState<{ topic?: string; title?: string; description?: string; status?: string }>({});
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

  /** Destino de la guía (grupo, jornada y materia), leído de la API por el id de la
   *  materia: el query string deja de ser el contexto principal (WEB-07d). */
  const [materia, setMateria] = useState<TeacherSubject | null>(null);
  const [falloDestino, setFalloDestino] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getTeacherOverview()
      .then((overview) => {
        if (cancelled) return;
        const encontrada = overview.subjects.find((subject) => subject.id === subjectId) ?? null;
        setMateria(encontrada);
        setFalloDestino(
          encontrada
            ? null
            : "No encontramos esta materia. Puede que la hayan quitado o que ya no sea tuya.",
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-07d] No se pudo cargar el destino de la guía:", error);
        setFalloDestino("No pudimos cargar el grupo y la materia de esta guía.");
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, intento]);

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
    if (!input) return;

    if (!file) {
      setErrores({ ...errores, title: "Selecciona un archivo PDF." });
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

  // El destino se pinta con datos de la API; si no llega, no se rellena el formulario a ciegas.
  if (falloDestino) {
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>{falloDestino}</ErrorScreen>;
  }
  if (!materia) return <LoadingScreen text="Cargando el destino de la guía…" />;

  /** Confirmación del estado final: en lugar de mandar a otra pantalla y perder el
   *  aviso, se queda aquí enseñando en qué ha quedado la guía.
   */
  if (creada) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Breadcrumb items={[
          { label: "Tus materias", href: "/profesor" },
          { label: materia.name, href: `/profesor/materias/${subjectId}` },
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
    // Dos columnas en escritorio, como en el Figma: a la izquierda el destino y el
    // formulario, a la derecha el panel «Antes de publicar», que ocupa sus cuatro filas.
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <Breadcrumb items={[
        { label: "Tus materias", href: "/profesor" },
        { label: materia.name, href: `/profesor/materias/${subjectId}` },
        { label: "Subir guía" },
      ]} />

      <header className="flex flex-col gap-1 lg:col-start-1">
        <h1 className="text-section font-semibold text-ink">Subir guía</h1>
        <p className="text-body text-muted">
          Sube un PDF de máximo 10 MB. Puede guardarse como borrador o publicarse
          directamente para que los estudiantes la vean.
        </p>
      </header>

      {/* Destino de la guía: sale de la API por el id de la materia, no del query string. */}
      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 lg:col-start-1">
        <h2 className="text-body font-semibold text-ink">Destino de la guía</h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-label font-semibold text-ink">Grupo asignado</dt>
            <dd className="text-body text-muted">{materia.group?.label ?? "Sin grupo asignado"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-label font-semibold text-ink">Jornada</dt>
            <dd className="text-body text-muted">{materia.group?.shiftLabel ?? "Sin jornada"}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-label font-semibold text-ink">Materia asignada</dt>
            <dd className="text-body text-muted">{materia.name}</dd>
          </div>
        </dl>
        <div className="rounded-card border border-line bg-tint p-4">
          <p className="text-label font-semibold text-ink">Quién verá esta guía</p>
          <p className="mt-1 text-meta text-muted">
            Los estudiantes de {materia.group?.label ?? "tu grupo"}
            {materia.group ? ` · ${materia.group.shiftLabel}` : ""}, en {materia.name}.
            Un borrador solo es visible para ti.
          </p>
        </div>
      </section>

      <aside className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 lg:col-start-2 lg:row-span-4 lg:row-start-1">
        <h2 className="text-body font-semibold text-ink">Antes de publicar</h2>
        <p className="text-meta text-muted">Comprueba el grupo, la materia y el archivo adjunto.</p>
        <p className="text-meta text-muted">Utiliza un título claro y un tema para facilitar la búsqueda.</p>
        <div className="flex flex-col gap-1 rounded-card border border-line bg-tint p-4">
          <p className="text-label font-semibold text-ink">Borrador o publicada</p>
          <p className="text-meta text-muted">
            Un borrador solo es visible para ti. Al publicar, la guía será visible
            para {materia.group?.label ?? "tu grupo"}.
          </p>
        </div>
      </aside>

      <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-6 lg:col-start-1">
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="text-body font-semibold text-ink">Datos de la guía</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Tema *"
              placeholder="Ej. Ecuaciones diferenciales"
              value={topic}
              error={errores.topic}
              onChange={(event) => setTopic(event.target.value)}
            />
            <Field
              label="Título *"
              placeholder="Ej. Guía 1: introducción"
              value={title}
              error={errores.title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-label font-semibold text-ink">Descripción *</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Qué cubre esta guía y para qué sirve"
              className={`min-h-[100px] w-full rounded-control border bg-surface px-3 py-3 text-body text-ink outline-none focus:border-2 focus:border-primary resize-none ${errores.description ? "border-2 border-primary" : "border-line"}`}
            />
            {errores.description && (
              <div className="flex items-start gap-2 rounded-card border border-line bg-tint p-3 text-label text-ink">
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
              type="file"
              accept=".pdf"
              onChange={(event) => {
                const f = event.target.files?.[0] ?? null;
                setFile(f);
                setFileName(f ? f.name : "");
              }}
              className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-ink outline-none focus:border-2 focus:border-primary"
            />
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
