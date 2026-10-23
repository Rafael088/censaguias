"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { subjectIcon } from "@/lib/subject-icon";
import { useStudent } from "../student-shell";

/** Mi grupo (Figma «estudiante-05»): datos del acceso y materias con sus docentes. */
export default function MiGrupoPage() {
  const router = useRouter();
  const { overview, status, reload } = useStudent();

  if (!overview) {
    return status === "error" ? (
      <ErrorScreen onRetry={reload}>No pudimos cargar los datos de tu grupo.</ErrorScreen>
    ) : (
      <LoadingScreen text="Cargando tu grupo…" />
    );
  }

  const { group, subjects } = overview;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[32px] font-semibold leading-tight text-ink">Mi grupo</h1>
        <p className="text-body text-muted md:hidden">Información de tu acceso actual.</p>
        <p className="hidden text-body text-muted md:block">
          Información académica del grupo al que has ingresado.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
          <p className="text-body font-semibold text-ink">{group.label}</p>
          <p className="text-body font-semibold text-ink md:hidden">
            Jornada {group.shift} · Año {group.schoolYear}
          </p>
          <p className="hidden text-body text-ink md:block">Jornada {group.shift}</p>
          <p className="hidden text-meta text-muted md:block">Año lectivo {group.schoolYear}</p>

          <p className="mt-2 text-meta font-semibold uppercase tracking-wide text-muted">Código de acceso</p>
          <p className="text-[24px] font-semibold tracking-wide text-ink">{group.code}</p>
          <p className="text-meta text-muted">
            <span className="hidden md:inline">Este código corresponde únicamente a {group.label}.</span>
            <span className="md:hidden">Este código corresponde solo a tu grupo.</span>
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="hidden text-body font-semibold text-ink md:block">Un acceso sencillo y privado</h2>
          <Notice title="No necesitas una cuenta para consultar tus guías">
            Tu acceso depende solo del código de grupo. No se solicita nombre de usuario, contraseña ni correo.
          </Notice>
          <p className="hidden text-meta text-muted md:block">
            ¿Este no es tu grupo? Sal e ingresa con el código que te entregue tu institución.
          </p>
          <p className="text-meta text-muted md:hidden">No necesitas una cuenta para consultar tus guías.</p>
          <Button variant="secondary" onClick={() => router.push("/mi-grupo/salir")} className="md:self-start">
            <LogOut size={18} aria-hidden />
            Salir / Cambiar código
          </Button>
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-section font-semibold text-ink">Tus materias y docentes</h2>

        {subjects.length === 0 ? (
          <EmptyState title="Tu grupo todavía no tiene materias" description="Tu institución las publicará aquí." />
        ) : (
          <>
            {/* Móvil: lista de una columna (Figma «estudiante-05» a 390 px). */}
            <ul className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 md:hidden">
              {subjects.map((subject) => {
                const Icon = subjectIcon(subject.name);
                return (
                  <li key={subject.id}>
                    <Link
                      href={`/materias/${subject.id}`}
                      className="flex min-h-11 items-center gap-3 rounded-control px-2 outline-none hover:bg-tint"
                    >
                      <Icon size={20} className="shrink-0 text-primary" aria-hidden />
                      <span className="text-label font-semibold text-ink">{subject.name}</span>
                      <span className="ml-auto text-meta text-muted">
                        {subject.guideCount} {subject.guideCount === 1 ? "guía" : "guías"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Escritorio: tabla con acciones de texto. */}
            <div className="hidden md:block">
              <DataTable
                head={[{ label: "Materia" }, { label: "Docente" }, { label: "Guías publicadas" }, { label: "Acción" }]}
                caption="Materias y docentes de tu grupo"
              >
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-semibold">{subject.name}</TableCell>
                    <TableCell className="text-muted">{subject.teacher ?? "Sin docente asignado"}</TableCell>
                    <TableCell className="text-muted">
                      {subject.guideCount} {subject.guideCount === 1 ? "guía" : "guías"}
                    </TableCell>
                    <TableCell>
                      <TableActions
                        actions={[
                          {
                            label: subject.guideCount > 0 ? "Ver guías" : "Ver materia",
                            onClick: () => router.push(`/materias/${subject.id}`),
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            </div>
          </>
        )}

        <p className="text-meta text-muted">
          Solo puedes consultar las guías publicadas para este grupo. Las asignaciones y los códigos los gestiona tu
          institución.
        </p>
      </section>
    </div>
  );
}
