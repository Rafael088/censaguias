"use client";

import { BookOpen, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import {
  getTeacherOverview,
  plural,
  type TeacherRecentGuide,
  type TeacherSubject,
} from "@/lib/teacher";

/** Inicio del área docente (Figma `profesor-01-mis-grupos`): «Hola, Laura» con sus
 *  materias, cuántas guías publicadas y en borrador tiene cada una, y sus guías
 *  recientes.
 */
export default function ProfesorInicio() {
  const router = useRouter();
  const [overview, setOverview] = useState<{
    subjects: TeacherSubject[];
    recentGuides: TeacherRecentGuide[];
  } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setActualizando(true);
    getTeacherOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setFallo(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-07] No se pudo cargar el espacio docente:", error);
        setFallo(true);
      })
      .finally(() => {
        if (!cancelled) setActualizando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [intento]);

  if (fallo) {
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar tus materias.</ErrorScreen>;
  }
  if (!overview) return <LoadingScreen text="Cargando tus materias…" />;

  const { subjects, recentGuides } = overview;
  const totalPublicadas = subjects.reduce((s, m) => s + m.publishedGuides, 0);
  const totalBorradores = subjects.reduce((s, m) => s + m.draftGuides, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">Tus materias</h1>
        <p className="text-body text-muted">
          Aquí ves tus materias asignadas, cuántas guías publicadas y en borrador
          tiene cada una, y tus guías más recientes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-display font-semibold text-ink">{subjects.length}</p>
              <p className="text-meta text-muted">materias asignadas</p>
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
          <div className="flex items-center gap-3">
            <FileText size={24} className="shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-display font-semibold text-ink">{totalPublicadas}</p>
              <p className="text-meta text-muted">{plural(totalPublicadas, "guía publicada", "guías publicadas")}</p>
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
          <div className="flex items-center gap-3">
            <FileText size={24} className="shrink-0 text-muted" aria-hidden />
            <div>
              <p className="text-display font-semibold text-ink">{totalBorradores}</p>
              <p className="text-meta text-muted">{plural(totalBorradores, "borrador", "borradores")}</p>
            </div>
          </div>
        </section>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          title="Todavía no tienes materias"
          description="Pide a tu administrador que te asigne una materia dentro de un grupo."
        />
      ) : (
        <section className="flex flex-col gap-4">
          <h2 className="text-section font-semibold text-ink">Tus materias y grupos</h2>
          <DataTable
            caption="Materias asignadas"
            head={[
              { label: "Materia" },
              { label: "Grupo" },
              { label: "Jornada" },
              { label: "Publicadas" },
              { label: "Borradores" },
              { label: "Acciones" },
            ]}
          >
            {subjects.map((materia) => (
              <TableRow key={materia.id}>
                <TableCell className="font-semibold">{materia.name}</TableCell>
                <TableCell className="text-muted">{materia.group?.label ?? "Sin grupo"}</TableCell>
                <TableCell className="text-muted">{materia.group?.shiftLabel ?? "—"}</TableCell>
                <TableCell className="text-muted">{materia.publishedGuides}</TableCell>
                <TableCell className="text-muted">{materia.draftGuides}</TableCell>
                <TableCell>
                  <TableActions
                    actions={[
                      {
                        label: "Ver guías",
                        onClick: () => {
                          // Navega a las guías de esta materia (ruta dinámica con params)
                          router.push(`/profesor/materias/${materia.id}?materiaName=${encodeURIComponent(materia.name)}`);
                        },
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </section>
      )}

      {recentGuides.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-section font-semibold text-ink">Tus guías recientes</h2>
          </div>
          <DataTable
            caption="Guías recientes"
            head={[
              { label: "Título" },
              { label: "Tema" },
              { label: "Materia" },
              { label: "Grupo" },
              { label: "Estado" },
              { label: "Actualizada" },
            ]}
          >
            {recentGuides.map((guia) => (
              <TableRow key={guia.id}>
                <TableCell className="font-semibold">{guia.title}</TableCell>
                <TableCell className="text-muted">{guia.topic}</TableCell>
                <TableCell className="text-muted">{guia.subject?.name ?? "—"}</TableCell>
                <TableCell className="text-muted">{guia.group?.label ?? "—"}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex min-h-8 items-center gap-1 rounded-control px-2 py-0.5 text-meta font-semibold ${
                      guia.status === "published"
                        ? "bg-tint text-ink"
                        : "bg-primary text-white"
                    }`}
                  >
                    {guia.status === "published" ? "Publicada" : "Borrador"}
                  </span>
                </TableCell>
                <TableCell className="text-muted">
                  {guia.updatedAt ? new Date(guia.updatedAt).toLocaleDateString("es-ES") : "—"}
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </section>
      )}
    </div>
  );
}
