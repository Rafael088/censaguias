"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { SearchInput } from "@/components/search-input";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { getSubjectGuides, plural, type TeacherGuide } from "@/lib/teacher";

/** Guías de una materia (Figma `profesor-02`): tabla con título, tema, estado,
 *  fecha, acciones (editar, publicar, borrar) y botón para subir una nueva guía.
 */
export default function MateriaGuías({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { id: subjectId } = use(params);
  const materiaName = searchParams.get("materiaName") || "";

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"draft" | "published" | "">("");
  const [topicFilter, setTopicFilter] = useState("");

  const [page, setPage] = useState(1);
  const [data, setData] = useState<TeacherGuide[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; published: number; drafts: number } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [intento, setIntento] = useState(0);
  const [topics, setTopics] = useState<string[]>([]);

  const cargar = useCallback(() => {
    let cancelled = false;
    setActualizando(true);
    getSubjectGuides(subjectId)
      .then((result) => {
        if (cancelled) return;
        setData(result.items);
        setSummary(result.summary);
        // Temas distintos para el filtro
        const temas: string[] = [];
        for (const g of result.items) if (!temas.includes(g.topic)) temas.push(g.topic);
        setTopics(temas);
        setFallo(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-07] No se pudo cargar las guías de la materia:", error);
        setFallo(true);
      })
      .finally(() => {
        if (!cancelled) setActualizando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId, intento]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (fallo) {
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar las guías de esta materia.</ErrorScreen>;
  }
  if (!data) return <LoadingScreen text="Cargando las guías…" />;

  const filtradas = data.filter((g) => {
    if (q && !g.title.toLowerCase().includes(q.toLowerCase()) && !g.topic.toLowerCase().includes(q.toLowerCase()))
      return false;
    if (statusFilter && g.status !== statusFilter) return false;
    if (topicFilter && g.topic !== topicFilter) return false;
    return true;
  });

  const pageSize = 12;
  const total = filtradas.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  const desde = (currentPage - 1) * pageSize;
  const hasta = Math.min(currentPage * pageSize, total);
  const pagina = filtradas.slice(desde, hasta);

  const sinResultados = q || statusFilter || topicFilter
    ? `No hay coincidencias para «${q || ""}». Revisa los filtros.`
    : "Esta materia todavía no tiene guías.";

  function limpiarFiltros() {
    setQ("");
    setStatusFilter("");
    setTopicFilter("");
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-section font-semibold text-ink">Guías de {materiaName || "esta materia"}</h1>
          <p className="text-body text-muted">
            {summary ? plural(summary.total, "guía", "guías") : ""} en esta materia.
          </p>
        </div>
        <Button onClick={() => router.push(`/profesor/materias/${subjectId}/nuevo`)}>
          <Plus size={18} aria-hidden />
          Subir guía
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-64 flex-1">
          <SearchInput
            label="Buscar por título o tema"
            placeholder="Buscar por título o tema"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-meta text-muted">Estado</span>
          <button
            onClick={() => setStatusFilter("")}
            className={`min-h-11 px-3 rounded-control border ${statusFilter === "" ? "bg-primary text-white border-primary" : "border-line bg-surface text-ink"} font-semibold text-ink outline-none hover:bg-tint`}
          >
            Todas
          </button>
          <button
            onClick={() => setStatusFilter("published")}
            className={`min-h-11 px-3 rounded-control border ${statusFilter === "published" ? "bg-primary text-white border-primary" : "border-line bg-surface text-ink"} font-semibold text-ink outline-none hover:bg-tint`}
          >
            Publicadas
          </button>
          <button
            onClick={() => setStatusFilter("draft")}
            className={`min-h-11 px-3 rounded-control border ${statusFilter === "draft" ? "bg-primary text-white border-primary" : "border-line bg-surface text-ink"} font-semibold text-ink outline-none hover:bg-tint`}
          >
            Borradores
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-meta text-muted">Tema</span>
          <select
            value={topicFilter}
            onChange={(event) => setTopicFilter(event.target.value)}
            className="min-h-11 w-full appearance-none rounded-control bg-surface px-3 pr-10 text-body text-ink outline-none border-line focus:border-2 focus:border-primary"
          >
            <option value="">Todos los temas</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <p className="text-meta text-muted">
          Mostrando {desde + 1}-{hasta} de {plural(total, "guía", "guías")}
        </p>
      </div>

      {total === 0 ? (
        q || statusFilter || topicFilter ? (
          <EmptyState
            icon={Plus}
            title="No encontramos guías"
            description={sinResultados}
            action={
              <Button variant="secondary" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Plus}
            title="Todavía no hay guías"
            description="Sube la primera guía de esta materia para que los estudiantes la vean publicada."
            action={
              <Button onClick={() => router.push(`/profesor/materias/${subjectId}/nuevo`)}>
                <Plus size={18} aria-hidden />
                Subir primera guía
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-4" aria-busy={actualizando}>
          <div className={actualizando ? "opacity-60" : ""}>
            <DataTable
              caption="Guías de la materia"
              head={[
                { label: "Título" },
                { label: "Tema" },
                { label: "Estado" },
                { label: "Archivo" },
                { label: "Páginas" },
                { label: "Actualizada" },
                { label: "Acciones" },
              ]}
            >
              {pagina.map((guia) => (
                <TableRow key={guia.id}>
                  <TableCell className="font-semibold">{guia.title}</TableCell>
                  <TableCell className="text-muted">{guia.topic}</TableCell>
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
                  <TableCell className="text-muted">{guia.fileName}</TableCell>
                  <TableCell className="text-muted">{guia.pageCount ?? "—"}</TableCell>
                  <TableCell className="text-muted">
                    {guia.updatedAt ? new Date(guia.updatedAt).toLocaleDateString("es-ES") : "—"}
                  </TableCell>
                  <TableCell>
                    <TableActions
                      actions={[
                        {
                          label: "Editar",
                          onClick: () => {
                            window.location.href = `/profesor/guias/${guia.id}`;
                          },
                        },
                        {
                          label:
                            guia.status === "published" ? "Despublicar" : "Publicar",
                          onClick: () => {
                            // Usamos la acción de publicar; para despublicar cambiaríamos el estado
                            window.location.href = `/profesor/guias/${guia.id}`;
                          },
                        },
                        {
                          label: "Eliminar",
                          onClick: () => {
                            if (
                              window.confirm(
                                `¿Eliminar la guía "${guia.title}"? Se borrará también su archivo PDF.`,
                              )
                            ) {
                              // Se manejaría con una acción de borrar; por ahora navegamos al detalle
                              window.location.href = `/profesor/guias/${guia.id}`;
                            }
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
