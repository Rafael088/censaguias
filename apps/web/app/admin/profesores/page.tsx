"use client";

import { Plus, Search, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { SearchInput } from "@/components/search-input";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { TeacherDeleteDialog } from "@/components/teacher-delete-dialog";
import { groupLines, listTeachers, teacherSubjects, type AdminTeacher, type TeacherListPage } from "@/lib/teachers";

const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`;

/**
 * Lista de profesores (Figma `admin-08-profesores`): buscador por nombre o
 * usuario, tabla con materias, grupos y acciones Ver · Editar · Eliminar,
 * paginación y los estados vacíos de admin-10.
 *
 * TODO(API-08): los datos vienen de `lib/teachers.ts`, que hoy sirve la muestra
 * del Figma; con la API real solo cambia esa capa.
 */
export default function AdminProfesores() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [qFiltrada, setQFiltrada] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<TeacherListPage | null>(null);
  const [fallo, setFallo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [intento, setIntento] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<AdminTeacher | null>(null);

  // El buscador no refresca la lista en cada tecla: espera a que se pare (300 ms).
  useEffect(() => {
    const timer = setTimeout(() => setQFiltrada(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  // Al cambiar la búsqueda se vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [qFiltrada]);

  // Volver desde el detalle tras eliminar: el aviso lleva el nombre del docente.
  useEffect(() => {
    const profesorEliminado = new URLSearchParams(window.location.search).get("eliminado");
    if (!profesorEliminado) return;
    setAviso(`${profesorEliminado} se eliminó. Sus materias quedaron sin docente y sus guías publicadas se conservan.`);
    // Se limpia la URL para que el aviso no vuelva al recargar.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setActualizando(true);
    listTeachers({ q: qFiltrada || undefined, page })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setFallo(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-06] No se pudo cargar la lista de profesores:", error);
        setFallo(true);
      })
      .finally(() => {
        if (!cancelled) setActualizando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qFiltrada, page, intento]);

  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 0;
  const current = data?.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const desde = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const hasta = Math.min(current * pageSize, total);

  // admin-10: la búsqueda sin coincidencias nombra lo que se buscó.
  const sinResultados = qFiltrada
    ? `No hay coincidencias para «${qFiltrada}». Revisa la búsqueda o quita los filtros.`
    : "Registra el primer docente para asignarle materias dentro de un grupo.";

  function limpiar() {
    // qFiltrada solo la mueve el debounce (300 ms): cambiar q basta para
    // que se reejecute la búsqueda ya sin filtro.
    setQ("");
  }

  function trasEliminar(profesor: AdminTeacher) {
    setAEliminar(null);
    setAviso(`${profesor.fullName} se eliminó. Sus materias quedaron sin docente y sus guías publicadas se conservan.`);
    // Si se borró el último de la página, la anterior deja de estar vacía.
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    else setIntento((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-section font-semibold text-ink">Profesores</h1>
          <p className="text-body text-muted">Registra docentes y administra sus asignaciones por grupo y materia.</p>
        </div>
        <Button onClick={() => router.push("/admin/profesores/nuevo")}>
          <Plus size={18} aria-hidden />
          Registrar profesor
        </Button>
      </header>

      {aviso && (
        <Notice tone="success" title="Profesor eliminado">
          {aviso}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <SearchInput
            label="Buscar por nombre o usuario"
            placeholder="Buscar por nombre o usuario"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <p className="text-meta text-muted">{plural(total, "docente activo", "docentes activos")}</p>
      </div>

      {fallo ? (
        <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>
          No pudimos cargar los profesores.
        </ErrorScreen>
      ) : !data ? (
        <LoadingScreen text="Cargando los profesores…" />
      ) : data.items.length === 0 ? (
        qFiltrada ? (
          <EmptyState
            icon={Search}
            title="No encontramos profesores"
            description={sinResultados}
            action={
              <Button variant="secondary" onClick={limpiar}>
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={UserRound}
            title="Todavía no hay profesores"
            description={sinResultados}
            action={
              <Button onClick={() => router.push("/admin/profesores/nuevo")}>
                <Plus size={18} aria-hidden />
                Registrar profesor
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-4" aria-busy={actualizando}>
          <div className={actualizando ? "opacity-60" : ""}>
            <DataTable
              caption="Profesores registrados"
              head={[
                { label: "Nombre y usuario" },
                { label: "Materias" },
                { label: "Grupos asignados" },
                { label: "Estado" },
                { label: "Acciones" },
              ]}
            >
              {data.items.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <span className="block font-semibold">{teacher.fullName}</span>
                    <span className="block text-muted">{teacher.username}</span>
                  </TableCell>
                  <TableCell>
                    {teacherSubjects(teacher).length === 0 ? (
                      <span className="text-muted">Sin materias</span>
                    ) : (
                      teacherSubjects(teacher).map((name) => <span key={name} className="block">{name}</span>)
                    )}
                  </TableCell>
                  <TableCell>
                    {groupLines(teacher).length === 0 ? (
                      <span className="text-muted">Sin grupos</span>
                    ) : (
                      groupLines(teacher).map((line) => <span key={line} className="block text-muted">{line}</span>)
                    )}
                  </TableCell>
                  <TableCell>{teacher.active ? "Activo" : "Inactivo"}</TableCell>
                  <TableCell>
                    <TableActions
                      actions={[
                        // admin-09 junta detalle y edición en una sola pantalla.
                        { label: "Ver", onClick: () => router.push(`/admin/profesores/${teacher.id}`) },
                        { label: "Editar", onClick: () => router.push(`/admin/profesores/${teacher.id}`) },
                        { label: "Eliminar", onClick: () => setAEliminar(teacher) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-meta text-muted">
              Mostrando {desde}-{hasta} de {plural(total, "profesor", "profesores")}
            </p>
            <div className="flex items-center gap-2">
              {pages > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || actualizando}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                >
                  Anterior
                </Button>
              )}
              <span className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 text-label font-semibold text-ink">
                Página {page}
              </span>
              {pages > 1 && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pages || actualizando}
                  onClick={() => setPage((n) => Math.min(pages, n + 1))}
                >
                  Siguiente
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <Notice title="El registro de docentes es administrativo">
        Solo el administrador crea los usuarios de personal y asigna cada docente a una materia específica dentro de
        un grupo.
      </Notice>

      <Notice title="Credenciales institucionales">
        La contraseña temporal se entrega al registrar al profesor. No se muestra en el listado ni en el detalle de un
        docente existente.
      </Notice>

      {aEliminar && (
        <TeacherDeleteDialog
          teacher={aEliminar}
          open
          onClose={() => setAEliminar(null)}
          onDeleted={() => trasEliminar(aEliminar)}
        />
      )}
    </div>
  );
}
