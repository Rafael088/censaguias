"use client";

import { BookOpen, FileText, Layers, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { DataTable, TableCell, TableRow } from "@/components/data-table";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { cleiLabel } from "@censaguias/shared";
import { getAdminSummary, NoStaffSession, type AdminSummary } from "@/lib/admin";

/** Número en palabras, para los rótulos del Figma («En tres jornadas»). */
const EN_LETRAS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis"];
const letra = (n: number) => EN_LETRAS[n] ?? String(n);
const mayuscula = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** «33,3 %» con coma decimal, como en el Figma. */
const porcentaje = (value: number) => `${value.toFixed(1).replace(".", ",")} %`;

/** Tarjeta de métrica de admin-01: icono, rótulo, número grande y pie. */
function Metrica({
  icon: Icon,
  label,
  value,
  foot,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
  foot: string;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
      <span className="flex items-center gap-2 text-meta text-muted">
        <Icon size={18} aria-hidden />
        {label}
      </span>
      <p className="text-display font-semibold text-ink">{value}</p>
      <p className="text-meta text-muted">{foot}</p>
    </article>
  );
}

/** Inicio del área de administración (Figma `admin-01-resumen`: «Resumen académico»). */
export default function AdminResumen() {
  const router = useRouter();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setEstado("cargando");
    getAdminSummary()
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setEstado("listo");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof NoStaffSession) {
          router.replace("/ingresar");
          return;
        }
        console.warn("[WEB-04] No se pudo cargar el resumen:", error);
        setEstado("error");
      });
    return () => {
      cancelled = true;
    };
  }, [intento, router]);

  if (estado === "cargando") return <LoadingScreen text="Cargando el resumen…" />;
  if (estado === "error" || !summary) {
    return (
      <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>
        No pudimos cargar el resumen académico.
      </ErrorScreen>
    );
  }

  const jornadasConGrupos = summary.shifts.filter((s) => s.groups > 0).length;
  const porJornada = summary.groups > 0 && summary.subjects % summary.groups === 0;
  const materiasPorGrupo = summary.groups > 0 ? summary.subjects / summary.groups : 0;
  const primeraJornada = summary.shifts[0];
  const reparto =
    summary.groups > 0 && primeraJornada && summary.shifts.every((s) => s.groups === primeraJornada.groups)
      ? ` · ${primeraJornada.groups} ${primeraJornada.groups === 1 ? "grupo" : "grupos"} por jornada`
      : "";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-section font-semibold text-ink">Resumen académico</h1>
          <p className="text-body text-muted">Una vista general de tus grupos, docentes y material publicado.</p>
        </div>
        <Button onClick={() => router.push("/admin/grupos/nuevo")}>
          <Plus size={18} aria-hidden />
          Crear grupo
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Cifras generales">
        <Metrica
          icon={Layers}
          label="Grupos CLEI"
          value={summary.groups}
          foot={summary.groups === 0 ? "Sin grupos todavía" : `En ${letra(jornadasConGrupos)} ${jornadasConGrupos === 1 ? "jornada" : "jornadas"}`}
        />
        <Metrica
          icon={UserRound}
          label="Profesores activos"
          value={summary.activeTeachers}
          foot="Con asignaciones vigentes"
        />
        <Metrica
          icon={BookOpen}
          label="Materias asignadas"
          value={summary.subjects}
          foot={
            summary.groups === 0
              ? "Sin materias todavía"
              : porJornada
                ? `${mayuscula(letra(materiasPorGrupo))} por cada grupo`
                : `Repartidas en ${summary.groups} ${summary.groups === 1 ? "grupo" : "grupos"}`
          }
        />
        <Metrica
          icon={FileText}
          label="Guías publicadas"
          value={summary.publishedGuides}
          foot="Disponibles para estudiantes"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-body font-semibold text-ink">Distribución por jornada</h2>
            <p className="text-meta text-muted">
              {summary.groups} {summary.groups === 1 ? "grupo activo" : "grupos activos"}
              {reparto}
            </p>
          </div>
          <ul className="flex flex-col gap-4">
            {summary.shifts.map((shift) => (
              <li key={shift.shift} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-label font-semibold text-ink">{shift.label}</p>
                  <p className="text-meta text-muted">
                    {shift.groups} {shift.groups === 1 ? "grupo" : "grupos"} · {porcentaje(shift.percent)}
                  </p>
                </div>
                <div
                  role="img"
                  aria-label={`${shift.label}: ${shift.groups} de ${summary.groups} grupos (${porcentaje(shift.percent)})`}
                  className="h-2 overflow-hidden rounded-full bg-tint"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(shift.percent, 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="text-body font-semibold text-ink">Accesos rápidos</h2>
          <Link
            href="/admin/grupos"
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-body font-semibold text-primary outline-none hover:bg-tint"
          >
            <Layers size={18} aria-hidden />
            Gestionar grupos CLEI
          </Link>
          <Link
            href="/admin/profesores"
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-body font-semibold text-primary outline-none hover:bg-tint"
          >
            <UserRound size={18} aria-hidden />
            Registrar profesor
          </Link>
          <p className="text-meta text-muted">
            Asigna cada docente a una materia específica dentro de un grupo. Los estudiantes solo verán las guías
            publicadas.
          </p>
        </article>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-section font-semibold text-ink">Grupos recientes</h2>
          <Link
            href="/admin/grupos"
            className="min-h-11 text-label font-semibold text-primary underline underline-offset-4 outline-none hover:opacity-80"
          >
            Ver todos los grupos
          </Link>
        </div>
        <DataTable
          caption="Los tres grupos CLEI más recientes"
          head={[{ label: "CLEI" }, { label: "Grupo" }, { label: "Jornada" }, { label: "Código único" }, { label: "Materias" }]}
        >
          {summary.recentGroups.map((group) => (
            <TableRow key={group.id}>
              <TableCell className="font-semibold">{cleiLabel(group.clei)}</TableCell>
              <TableCell className="text-muted">{group.identifier}</TableCell>
              <TableCell className="text-muted">{group.shiftLabel}</TableCell>
              <TableCell className="text-muted">{group.accessCode}</TableCell>
              <TableCell className="text-muted">
                {typeof group.subjects === "number"
                  ? `${group.subjects} ${group.subjects === 1 ? "materia" : "materias"}`
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </DataTable>
      </section>
    </div>
  );
}
