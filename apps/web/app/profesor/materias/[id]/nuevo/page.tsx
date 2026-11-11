"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Select } from "@/components/select";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { createGuide, plural, validateGuideForm, type TeacherGuideFormValues } from "@/lib/teacher";

/** Subir una guía (Figma `profesor-03`): tema, título, descripción, estado
 *  (borrador o publicada) y el archivo PDF (máx. 10 MB).
 */
export default function SubirGuía() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const subjectId = searchParams.get("subjectId") || "";
  const materiaName = searchParams.get("materiaName") || "";

  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");

  const [errores, setErrores] = useState<{ topic?: string; title?: string; description?: string; status?: string }>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors, input } = validateGuideForm({ topic, title, description, status });
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

    setGuardando(true);
    try {
      await createGuide(subjectId, form);
      router.push(`/profesor/materias/${subjectId}`);
    } catch (err) {
      console.warn("[WEB-07] No se pudo subir la guía:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos subir la guía.");
    } finally {
      setGuardando(false);
    }
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
          <Select
            label="Estado *"
            value={status}
            error={errores.status}
            onChange={(event) => setStatus(event.target.value as "draft" | "published")}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicada</option>
          </Select>
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
            <Button variant="secondary" type="button" disabled={guardando} onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando || !file}>
              {guardando ? "Subiendo…" : "Subir guía"}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}
