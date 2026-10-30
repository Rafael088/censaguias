"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SHIFT_LABEL, cleiLabel, type Shift } from "@censaguias/shared";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FilterTabs, type TabOption } from "@/components/filter-tabs";
import { GroupDeleteDialog } from "@/components/group-delete-dialog";
import { Notice } from "@/components/notice";
import { SearchInput } from "@/components/search-input";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { listGroups, NoStaffSession, subjectsCount, type AdminGroup, type GroupListPage } from "@/lib/admin";

/** Pestañas de admin-02: Todas · Mañana · Noche · Sabatina. */
const JORNADAS: TabOption[] = [
  { value: "", label: "Todas" },
  { value: "morning", label: SHIFT_LABEL.morning },
  { value: "night", label: SHIFT_LABEL.night },
  { value: "saturday", label: SHIFT_LABEL.saturday },
];

const plural = (n: number, uno: string, muchos: string) => `${n} ${n === 1 ? uno : muchos}`;

/**
 * Lista de grupos CLEI (Figma `admin-02-grupos`): buscador, filtro de jornada,
 * tabla con Ver · Editar · Eliminar, paginación y los estados vacíos de admin-10.
 */
export default function AdminGrupos() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [qFiltrada, setQFiltrada] = useState("");
  const [shift, setShift] = useState<Shift | "">("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<GroupListPage | null>(null);
  const [fallo, setFallo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [intento, setIntento] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<AdminGroup | null>(null);

  // El buscador no refresca la lista en cada tecla: espera a que se pare (300 ms).
  useEffect(() => {
    const timer = setTimeout(() => setQFiltrada(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  // Al cambiar la búsqueda o la jornada se vuelve a la primera página.
  useEffect(() => {
    setPage(1);
  }, [qFiltrada, shift]);

  // Volver desde la edición tras eliminar: el aviso lleva el nombre del grupo.
  useEffect(() => {
    const grupoEliminado = new URLSearchParams(window.location.search).get("eliminado");
    if (!grupoEliminado) return;
    setAviso(`${grupoEliminado} se eliminó junto con sus materias y guías.`);
    // Se limpia la URL para que el aviso no vuelva al recargar.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setActualizando(true);
    listGroups({ q: qFiltrada || undefined, shift: shift || undefined, page })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setFallo(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof NoStaffSession) {
          router.replace("/ingresar");
          return;
        }
        console.warn("[WEB-04] No se pudo cargar la lista de grupos:", error);
        setFallo(true);
      })
      .finally(() => {
        if (!cancelled) setActualizando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [qFiltrada, shift, page, intento, router]);

  const filtrando = qFiltrada.length > 0 || shift !== "";
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 0;
  const current = data?.page ?? 1;
  const pages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const desde = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const hasta = Math.min(current * pageSize, total);

  // admin-10: la búsqueda sin coincidencias nombra lo que se buscó.
  const sinResultados = filtrando
    ? qFiltrada
      ? `No hay coincidencias para «${qFiltrada}». Revisa la búsqueda o quita los filtros.`
      : `No hay grupos en la jornada ${SHIFT_LABEL[shift as Shift]}. Cambia de jornada o quita los filtros.`
    : "Crea el primer grupo CLEI para organizar sus materias, docentes y código de acceso.";

  function limpiar() {
    // qFiltrada solo la mueve el debounce (300 ms): cambiar q y shift basta para
    // que se reejecute la búsqueda con los filtros ya vacíos.
    setQ("");
    setShift("");
  }

  function trasEliminar(grupo: AdminGroup) {
    setAEliminar(null);
    setAviso(`${grupo.label} se eliminó junto con sus materias y guías.`);
    // Si se borró el último de la página, la anterior deja de estar vacía.
    if (data && data.items.length === 1 && page > 1) setPage(page - 1);
    else setIntento((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-section font-semibold text-ink">Grupos CLEI</h1>
          <p className="text-body text-muted">Organiza los grupos, sus materias y los códigos de acceso.</p>
        </div>
        <Button onClick={() => router.push("/admin/grupos/nuevo")}>
          <Plus size={18} aria-hidden />
          Crear grupo
        </Button>
      </header>

      {aviso && (
        <Notice tone="success" title="Grupo eliminado">
          {aviso}
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <SearchInput
            label="Buscar por CLEI, grupo o código"
            placeholder="Buscar por CLEI, grupo o código"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <p className="text-meta text-muted">{plural(total, "grupo registrado", "grupos registrados")}</p>
      </div>

      <FilterTabs
        label="Filtrar por jornada"
        options={JORNADAS}
        value={shift}
        // Los valores salen de JORNADAS: solo jornadas válidas o vacío (todas).
        onChange={(value) => setShift(value as Shift | "")}
      />

      {fallo ? (
        <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>
          No pudimos cargar los grupos CLEI.
        </ErrorScreen>
      ) : !data ? (
        <LoadingScreen text="Cargando los grupos…" />
      ) : data.items.length === 0 ? (
        filtrando ? (
          <EmptyState
            icon={Search}
            title="No encontramos grupos"
            description={sinResultados}
            action={
              <Button variant="secondary" onClick={limpiar}>
                Limpiar búsqueda
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Plus}
            title="Todavía no hay grupos"
            description={sinResultados}
            action={
              <Button onClick={() => router.push("/admin/grupos/nuevo")}>
                <Plus size={18} aria-hidden />
                Crear grupo
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-4" aria-busy={actualizando}>
          <div className={actualizando ? "opacity-60" : ""}>
            <DataTable
              caption="Grupos CLEI registrados"
              head={[
                { label: "CLEI" },
                { label: "Grupo" },
                { label: "Jornada" },
                { label: "Código único" },
                { label: "Materias" },
                { label: "Acciones" },
              ]}
            >
              {data.items.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-semibold">{cleiLabel(group.clei)}</TableCell>
                  <TableCell className="text-muted">{group.identifier}</TableCell>
                  <TableCell className="text-muted">{group.shiftLabel}</TableCell>
                  <TableCell className="text-muted">{group.accessCode}</TableCell>
                  <TableCell className="text-muted">{plural(subjectsCount(group), "materia", "materias")}</TableCell>
                  <TableCell>
                    <TableActions
                      actions={[
                        // El detalle (admin-05) lo construye WEB-05.
                        { label: "Ver", onClick: () => router.push(`/admin/grupos/${group.id}`) },
                        { label: "Editar", onClick: () => router.push(`/admin/grupos/${group.id}/editar`) },
                        { label: "Eliminar", onClick: () => setAEliminar(group) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-meta text-muted">
              Mostrando {desde}-{hasta} de {plural(total, "grupo", "grupos")}
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

      <Notice title="Un código único para cada grupo">
        Comparte únicamente el código del grupo correspondiente. Regenerar un código invalida el anterior.
      </Notice>

      <section className="flex flex-col gap-1">
        <h2 className="text-body font-semibold text-ink">De grupo a materia, de materia a docente</h2>
        <p className="text-body text-muted">
          Abre el detalle de un grupo para añadir materias y asignar a cada una un profesor registrado.
        </p>
      </section>

      {aEliminar && (
        <GroupDeleteDialog
          group={aEliminar}
          open
          onClose={() => setAEliminar(null)}
          onDeleted={() => trasEliminar(aEliminar)}
        />
      )}
    </div>
  );
}
