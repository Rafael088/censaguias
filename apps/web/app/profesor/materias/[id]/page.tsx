"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { Dialog } from "@/components/dialog";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { SearchInput } from "@/components/search-input";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { deleteGuide, getSubjectGuides, plural, publishGuide, type TeacherGuide } from "@/lib/teacher";

/** Tamaño del PDF en el idioma del Figma («de 1,8 MB»). */
function sizeTexto(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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

  // Publicar / eliminar: diálogo de confirmación del Figma `profesor-06`.
  const [dialogo, setDialogo] = useState<{ tipo: "publicar" | "eliminar"; guia: TeacherGuide } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; texto: string } | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

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

  /** Lo que hace el botón del diálogo: publicar el borrador o eliminar la guía, de verdad. */
  async function confirmarAccion() {
    if (!dialogo || ocupado) return;
    const { tipo, guia } = dialogo;
    setOcupado(true);
    setErrorAccion(null);
    setAviso(null);
    try {
      if (tipo === "publicar") {
        await publishGuide(guia.id);
        setAviso({
          titulo: "Guía publicada correctamente",
          texto: `${guia.title} ya está disponible para ${materiaName || "tu grupo"}.`,
        });
      } else {
        await deleteGuide(guia.id);
        setAviso({
          titulo: "Guía eliminada",
          texto: `${guia.title} y su PDF ya no están en ${materiaName || "esta materia"}.`,
        });
      }
      setDialogo(null);
      cargar();
    } catch (error) {
      console.warn("[WEB-07b] No se pudo completar la acción:", error);
      setErrorAccion(error instanceof Error ? error.message : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
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

      {errorAccion && (
        <Notice tone="error" title="No se pudo completar la acción">
          {errorAccion}
        </Notice>
      )}
      {aviso && !errorAccion && (
        <Notice tone="success" title={aviso.titulo}>
          {aviso.texto}
        </Notice>
      )}

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
                            router.push(`/profesor/guias/${guia.id}`);
                          },
                        },
                        // Figma `profesor-02`: el borrador se publica y la publicada se
                        // elimina. No hay «Despublicar»: la API solo publica.
                        ...(guia.status === "draft"
                          ? [
                              {
                                label: "Publicar",
                                onClick: () => setDialogo({ tipo: "publicar", guia }),
                              },
                            ]
                          : [
                              {
                                label: "Eliminar",
                                onClick: () => setDialogo({ tipo: "eliminar", guia }),
                              },
                            ]),
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

      <Dialog
        open={dialogo !== null}
        onClose={() => {
          if (!ocupado) setDialogo(null);
        }}
        title={dialogo?.tipo === "publicar" ? "¿Publicar esta guía?" : "¿Eliminar esta guía?"}
        description={
          dialogo
            ? `${dialogo.guia.title} · ${dialogo.guia.topic}${materiaName ? ` · ${materiaName}` : ""}`
            : undefined
        }
        actions={
          <>
            <Button variant="secondary" disabled={ocupado} onClick={() => setDialogo(null)}>
              Cancelar
            </Button>
            <Button disabled={ocupado} onClick={() => void confirmarAccion()}>
              {ocupado
                ? dialogo?.tipo === "publicar"
                  ? "Publicando…"
                  : "Eliminando…"
                : dialogo?.tipo === "publicar"
                  ? "Publicar guía"
                  : "Eliminar guía"}
            </Button>
          </>
        }
      >
        <Notice title="Antes de continuar">
          {dialogo?.tipo === "publicar"
            ? `Será visible para los estudiantes de este grupo. El PDF adjunto es ${dialogo.guia.fileName}, de ${sizeTexto(dialogo.guia.sizeBytes)}.`
            : "Se eliminarán la guía y su PDF. Esta acción es irreversible y no podrás recuperar el contenido."}
        </Notice>
      </Dialog>
    </div>
  );
}
