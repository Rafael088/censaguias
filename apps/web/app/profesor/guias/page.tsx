"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FilterTabs } from "@/components/filter-tabs";
import { SearchInput } from "@/components/search-input";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { getTeacherGuides, plural, type TeacherRecentGuide } from "@/lib/teacher";

/** «Mis guías» (barra lateral del Figma `profesor-01`): todas las guías del profesor
 *  de todas sus materias, con materia, grupo, estado y edición. Mismo filtro y misma
 *  tabla que la lista por materia (profesor-02).
 */
export default function MisGuías() {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"draft" | "published" | "">("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<TeacherRecentGuide[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; published: number; drafts: number } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setActualizando(true);
    getTeacherGuides()
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setSummary(result.summary);
        setFallo(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-07b] No se pudo cargar Mis guías:", error);
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
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar tus guías.</ErrorScreen>;
  }
  if (!items) return <LoadingScreen text="Cargando tus guías…" />;

  const filtradas = items.filter((guia) => {
    const term = q.toLowerCase();
    if (q && !guia.title.toLowerCase().includes(term) && !guia.topic.toLowerCase().includes(term)) return false;
    if (statusFilter && guia.status !== statusFilter) return false;
    return true;
  });

  const pageSize = 12;
  const total = filtradas.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  const desde = (currentPage - 1) * pageSize;
  const hasta = Math.min(currentPage * pageSize, total);
  const pagina = filtradas.slice(desde, hasta);

  function limpiarFiltros() {
    setQ("");
    setStatusFilter("");
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">Mis guías</h1>
        <p className="text-body text-muted">
          Todas las guías de tus materias, con el grupo al que pertenecen y su estado.
        </p>
        <p className="text-meta text-muted">
          {summary
            ? `${plural(summary.total, "guía", "guías")} · ${plural(summary.published, "publicada", "publicadas")} · ${plural(summary.drafts, "borrador", "borradores")}`
            : ""}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <SearchInput
            label="Buscar por título o tema"
            placeholder="Buscar por título o tema"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <FilterTabs
          label="Filtrar por estado"
          options={[
            { value: "", label: "Todas" },
            { value: "published", label: "Publicadas" },
            { value: "draft", label: "Borradores" },
          ]}
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value as "draft" | "published" | "");
            setPage(1);
          }}
        />
        <p className="text-meta text-muted">
          {total > 0 ? `Mostrando ${desde + 1}-${hasta} de ${plural(total, "guía", "guías")}` : ""}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aún no has creado guías"
          description="Crea la primera guía de una de tus materias para uno de tus grupos asignados. Puedes guardarla como borrador antes de publicar."
          action={
            <Button onClick={() => router.push("/profesor")}>Ver mis materias</Button>
          }
        />
      ) : total === 0 ? (
        <EmptyState
          icon={FileText}
          title="No encontramos guías"
          description={`No hay coincidencias para «${q}». Revisa los filtros.`}
          action={
            <Button variant="secondary" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4" aria-busy={actualizando}>
          <div className={actualizando ? "opacity-60" : ""}>
            <DataTable
              caption="Mis guías"
              head={[
                { label: "Título" },
                { label: "Tema" },
                { label: "Materia" },
                { label: "Grupo" },
                { label: "Estado" },
                { label: "Actualizada" },
                { label: "Acciones" },
              ]}
            >
              {pagina.map((guia) => (
                <TableRow key={guia.id}>
                  <TableCell className="font-semibold">{guia.title}</TableCell>
                  <TableCell className="text-muted">{guia.topic}</TableCell>
                  <TableCell className="text-muted">{guia.subject?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted">{guia.group?.label ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex min-h-8 items-center gap-1 rounded-control px-2 py-0.5 text-meta font-semibold ${
                        guia.status === "published" ? "bg-tint text-ink" : "bg-primary text-white"
                      }`}
                    >
                      {guia.status === "published" ? "Publicada" : "Borrador"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted">
                    {guia.updatedAt ? new Date(guia.updatedAt).toLocaleDateString("es-ES") : "—"}
                  </TableCell>
                  <TableCell>
                    <TableActions
                      actions={[
                        {
                          label: "Editar",
                          onClick: () => {
                            router.push(`/profesor/guias/${guia.id}`);
                          },
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage <= 1 || actualizando}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                >
                  Anterior
                </Button>
                <span className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 text-label font-semibold text-ink">
                  Página {currentPage} de {pages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= pages || actualizando}
                  onClick={() => setPage((n) => Math.min(pages, n + 1))}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
