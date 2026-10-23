"use client";

import { useRouter } from "next/navigation";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { GroupHeader } from "@/components/group-header";
import { Notice } from "@/components/notice";
import { SubjectCard } from "@/components/subject-card";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { abrirGuia, descargarGuia } from "@/lib/guide-file";
import { formatBytes, formatDate } from "@/lib/format";
import { subjectIcon } from "@/lib/subject-icon";
import { useStudent } from "../student-shell";

/** Mis materias (Figma «estudiante-01»): grupo, tarjetas de materia y últimas guías publicadas. */
export default function MateriasPage() {
  const router = useRouter();
  const { overview, status, reload } = useStudent();

  if (!overview) {
    return status === "error" ? (
      <ErrorScreen onRetry={reload}>No pudimos cargar las materias de tu grupo.</ErrorScreen>
    ) : (
      <LoadingScreen text="Cargando tus materias…" />
    );
  }

  const { group, subjects, latestGuides, guideCount } = overview;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-[32px] font-semibold leading-tight text-ink">Mis materias</h1>
        <p className="text-body text-muted">Encuentra las guías publicadas para tu grupo, organizadas por materia.</p>
      </header>

      <GroupHeader name={group.label} journey={group.shift} year={group.schoolYear} code={group.code} />

      {subjects.length === 0 ? (
        <EmptyState
          title="Tu grupo todavía no tiene materias"
          description="Tu institución las publicará aquí cuando estén listas."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <SubjectCard
              key={subject.id}
              name={subject.name}
              description={subject.description ?? undefined}
              teacher={subject.teacher ?? undefined}
              guideCount={subject.guideCount}
              href={`/materias/${subject.id}`}
              icon={subjectIcon(subject.name)}
            />
          ))}
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-section font-semibold text-ink">Últimas guías publicadas</h2>
          <p className="text-meta text-muted">
            {guideCount} {guideCount === 1 ? "guía disponible" : "guías disponibles"} en tu grupo
          </p>
        </div>

        {latestGuides.length === 0 ? (
          <EmptyState
            title="Aún no hay guías publicadas"
            description="Tu profesor las compartirá aquí."
          />
        ) : (
          <DataTable
            caption="Últimas guías publicadas en tu grupo"
            head={[{ label: "Guía" }, { label: "Materia / Tema" }, { label: "Publicación" }, { label: "Archivo" }, { label: "Acciones" }]}
          >
            {latestGuides.map((guide) => (
              <TableRow key={guide.id}>
                <TableCell className="font-semibold">{guide.title}</TableCell>
                <TableCell className="text-muted">
                  {guide.subject.name} / {guide.topic}
                </TableCell>
                <TableCell className="text-muted">{formatDate(guide.publishedAt)}</TableCell>
                <TableCell className="text-muted">PDF · {formatBytes(guide.sizeBytes)}</TableCell>
                <TableCell>
                  <TableActions
                    actions={[
                      { label: "Abrir", onClick: () => router.push(`/guias/${guide.id}`) },
                      { label: "Descargar", onClick: () => void descargarGuia(guide.id) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        )}
      </section>

      <Notice tone="info" title={`Estás en ${group.label} · ${group.shift}`}>
        Solo ves materias y guías publicadas de este grupo. Si no es tu grupo, sal e ingresa el código correcto.
      </Notice>
    </div>
  );
}
