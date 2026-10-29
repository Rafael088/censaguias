"use client";

import { BookOpen, Download, ExternalLink } from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb, MobileBack } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { FilterTabs } from "@/components/filter-tabs";
import { GuideCard } from "@/components/guide-card";
import { GroupHeader } from "@/components/group-header";
import { Notice } from "@/components/notice";
import { SearchInput } from "@/components/search-input";
import { StatusChip } from "@/components/status-chip";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { fileMeta } from "@/lib/format";
import { abrirGuia, descargarGuia } from "@/lib/guide-file";
import { getStudentSubject, type StudentSubjectDetail } from "@/lib/student";
import { useStudent } from "../../student-shell";

const TODOS = "__todos__";

const normalizar = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Guías de una materia (Figma «estudiante-02» y «estudiante-04»: con guías y vacía). */
export default function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { overview, status: statusGrupo, reload } = useStudent();

  const [detail, setDetail] = useState<StudentSubjectDetail | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "no-encontrada" | "error">("cargando");
  const [intento, setIntento] = useState(0);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(TODOS);

  useEffect(() => {
    let cancelled = false;
    setEstado("cargando");
    getStudentSubject(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) setEstado("no-encontrada");
        else {
          setDetail(data);
          setEstado("listo");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-02] No se pudo cargar la materia:", error);
        setEstado("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, intento]);

  const visibles = useMemo(() => {
    const guides = detail?.guides ?? [];
    const q = normalizar(query.trim());
    return guides.filter((guide) => {
      const coincideTopico = topic === TODOS || guide.topic === topic;
      const coincideBusqueda =
        q === "" || normalizar(guide.title).includes(q) || normalizar(guide.topic).includes(q);
      return coincideTopico && coincideBusqueda;
    });
  }, [detail, query, topic]);

  if (statusGrupo === "error") {
    return <ErrorScreen onRetry={reload}>No pudimos cargar tu grupo.</ErrorScreen>;
  }
  if (statusGrupo === "cargando" || !overview) {
    return <LoadingScreen text="Cargando tu grupo…" />;
  }

  if (estado === "cargando") return <LoadingScreen text="Cargando las guías…" />;
  if (estado === "error")
    return (
      <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar las guías de esta materia.</ErrorScreen>
    );
  if (estado === "no-encontrada" || !detail) {
    return (
      <div className="flex flex-col gap-4">
        <MobileBack href="/materias" />
        <EmptyState
          title="No encontramos esta materia"
          description="Puede que se haya dejado de impartir en tu grupo."
          action={
            <Button variant="secondary" onClick={() => router.push("/materias")}>
              Volver a materias
            </Button>
          }
        />
      </div>
    );
  }

  const { subject, group, guides, topics } = detail;
  const sinGuias = guides.length === 0;
  const otrasConGuias = overview.subjects.filter((s) => s.id !== subject.id && s.guideCount > 0);
  const sugerencia = otrasConGuias
    .map(
      (s) =>
        `En ${s.name} tienes ${s.guideCount} ${s.guideCount === 1 ? "guía disponible" : "guías publicadas"}`,
    )
    .join(" y ");

  return (
    <div className="flex flex-col gap-6">
      <MobileBack href="/materias" />
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Mis materias", href: "/materias" }, { label: subject.name }]} />
        <header className="flex flex-col gap-1">
          <h1 className="text-[32px] font-semibold leading-tight text-ink">Guías de {subject.name}</h1>
          <p className="text-body text-muted">
            {subject.teacher ? `${subject.teacher} · ` : ""}Material publicado para tu grupo.
          </p>
        </header>
      </div>

      <GroupHeader name={group.label} journey={group.shift} year={group.schoolYear} code={group.code} />

      {sinGuias ? (
        <div className="flex flex-col gap-6">
          <p className="w-fit rounded-control border border-line bg-tint px-2.5 py-1 text-meta font-semibold text-ink">
            <BookOpen size={14} className="mr-1.5 inline align-[-2px]" aria-hidden />
            0 guías publicadas
          </p>
          <EmptyState
            title="Aún no hay guías publicadas"
            description="Tu profesor las compartirá aquí."
            icon={BookOpen}
            action={
              <Button variant="secondary" onClick={() => router.push("/materias")}>
                Volver a materias
              </Button>
            }
          />
          {otrasConGuias.length > 0 && (
            <section className="flex flex-col gap-1">
              <h2 className="text-body font-semibold text-ink">Mientras tanto, explora tus otras materias</h2>
              <p className="text-meta text-muted">
                {sugerencia} para {group.label}.
              </p>
            </section>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <SearchInput
              label="Buscar guía por título o tema"
              placeholder="Buscar guía por título o tema"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <FilterTabs
              label="Filtrar por tema"
              value={topic}
              onChange={setTopic}
              options={[{ value: TODOS, label: "Todos los temas" }, ...topics.map((t) => ({ value: t, label: t }))]}
            />
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-label font-semibold text-ink">
              {visibles.length} {visibles.length === 1 ? "guía publicada" : "guías publicadas"}
            </p>
            <p className="text-meta text-muted">Más recientes primero</p>
          </div>

          {visibles.length === 0 ? (
            <EmptyState
              title="No encontramos guías con esa búsqueda"
              description="Prueba con otro título o vuelve a elegir «Todos los temas»."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setTopic(TODOS);
                  }}
                >
                  Limpiar búsqueda
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibles.map((guide) => (
                <GuideCard
                  key={guide.id}
                  topic={guide.topic.toUpperCase()}
                  title={guide.title}
                  description={guide.description.split("\n\n")[0]}
                  meta={fileMeta(guide.sizeBytes, guide.publishedAt)}
                  badge={<StatusChip status="published" />}
                  actions={
                    <>
                      <Button size="sm" onClick={() => void abrirGuia(guide.id)}>
                        <ExternalLink size={16} aria-hidden />
                        Abrir guía
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void descargarGuia(guide.id)}>
                        <Download size={16} aria-hidden />
                        Descargar
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          )}

          <Notice tone="info" title="Consulta a tu ritmo">
            Abre las guías para leerlas en el navegador o descárgalas en PDF para consultarlas después.
          </Notice>
        </>
      )}
    </div>
  );
}
