import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { SupabaseClient } from "@supabase/supabase-js";
import { groupLabel, SHIFT_LABEL, studentGuideListQuery } from "@censaguias/shared";
import { requireStudent, type AppVars } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { GROUP_COLUMNS, throwSupabase, type GroupRow } from "../lib/groups.js";
import { findStudentGuide, GUIDE_COLUMNS, mapGuide, type GuideRow } from "../lib/guides.js";
import { findSubject, type SubjectRow } from "../lib/subjects.js";

/** Cuántas guías trae «Últimas guías publicadas» de Mis materias (estudiante-01). */
const RECENT_GUIDES = 10;

type MySubjectRow = { id: string; name: string; description: string | null; teacher_id: string | null };

/** El grupo como lo ve el estudiante: etiqueta, jornada y código ya rotulados. */
const mapGroup = (row: GroupRow) => ({
  id: row.id,
  label: groupLabel(row),
  shift: row.shift,
  shiftLabel: SHIFT_LABEL[row.shift],
  schoolYear: row.school_year,
  accessCode: row.access_code,
});

/** El grupo de la sesión; si desapareciera entre medias, la caída es la misma que con el código viejo. */
async function sessionGroup(db: SupabaseClient, groupId: string): Promise<GroupRow> {
  const { data, error } = await db.from("groups").select(GROUP_COLUMNS).eq("id", groupId).maybeSingle();
  if (error) throwSupabase(error);
  if (!data) throw new HTTPException(401, { message: "El código ya no es válido" });
  return data as GroupRow;
}

/** La cabecera de las pantallas de guías: la materia con su docente y su grupo. */
async function subjectCard(db: SupabaseClient, subject: SubjectRow) {
  let teacher: { fullName: string } | null = null;
  if (subject.teacher_id) {
    const { data } = await db.from("profiles").select("full_name").eq("id", subject.teacher_id).maybeSingle();
    if (data) teacher = { fullName: (data as { full_name: string }).full_name };
  }
  const group = await sessionGroup(db, subject.group_id);
  return {
    id: subject.id,
    name: subject.name,
    description: subject.description,
    teacher,
    group: mapGroup(group),
  };
}

/**
 * Rutas del estudiante (API-07): entran con el código del grupo y solo ven su grupo y
 * guías publicadas. La sesión ya la validó requireStudent (cookie + versión del código).
 */
export const studentRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStudent)
  // Mis materias y Mi grupo: el grupo, sus materias con docente y recuento, y las últimas
  // guías publicadas del grupo (las pantallas 01 y 05 del Figma).
  .get("/group", async (c) => {
    const db = supabaseAdmin();
    const { groupId } = c.get("student");
    const group = await sessionGroup(db, groupId);

    const { data: subjectRows, error: subjectsError } = await db
      .from("subjects")
      .select("id, name, description, teacher_id")
      .eq("group_id", groupId)
      .order("name");
    if (subjectsError) throwSupabase(subjectsError);
    const subjects = (subjectRows ?? []) as MySubjectRow[];

    const teacherIds = [...new Set(subjects.map((subject) => subject.teacher_id).filter((id): id is string => id !== null))];
    const teacherNames = new Map<string, string>();
    if (teacherIds.length > 0) {
      const { data: teachers, error } = await db.from("profiles").select("id, full_name").in("id", teacherIds);
      if (error) throwSupabase(error);
      for (const teacher of (teachers ?? []) as { id: string; full_name: string }[]) {
        teacherNames.set(teacher.id, teacher.full_name);
      }
    }

    // Las guías publicadas del grupo de una sola consulta: dan el recuento de cada materia
    // y la de «últimas publicadas».
    const subjectIds = subjects.map((subject) => subject.id);
    let guides: GuideRow[] = [];
    if (subjectIds.length > 0) {
      const { data, error } = await db
        .from("guides")
        .select(GUIDE_COLUMNS)
        .in("subject_id", subjectIds)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throwSupabase(error);
      guides = (data ?? []) as GuideRow[];
    }

    const published = new Map<string, number>();
    for (const guide of guides) published.set(guide.subject_id, (published.get(guide.subject_id) ?? 0) + 1);
    const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));

    return c.json({
      group: mapGroup(group),
      subjects: subjects.map((subject) => {
        const fullName = subject.teacher_id ? teacherNames.get(subject.teacher_id) : undefined;
        return {
          id: subject.id,
          name: subject.name,
          description: subject.description,
          teacher: fullName ? { fullName } : null,
          publishedGuides: published.get(subject.id) ?? 0,
        };
      }),
      recentGuides: guides.slice(0, RECENT_GUIDES).map((guide) => ({
        id: guide.id,
        title: guide.title,
        topic: guide.topic,
        publishedAt: guide.published_at,
        fileName: guide.file_name,
        sizeBytes: guide.size_bytes,
        subject: { id: guide.subject_id, name: subjectsById.get(guide.subject_id)?.name ?? null },
      })),
      totalPublishedGuides: guides.length,
    });
  })
  // Guías de una materia (estudiante-02): solo publicadas, con sus temas y el filtro de búsqueda.
  .get(
    "/subjects/:id/guides",
    zValidator("query", studentGuideListQuery, (result, c) => {
      if (!result.success) return c.json({ error: "Filtros no válidos" }, 400);
    }),
    async (c) => {
      const { topic, q } = c.req.valid("query");
      const db = supabaseAdmin();
      const { groupId } = c.get("student");

      const subject = await findSubject(db, c.req.param("id"));
      // La materia de otro grupo no existe para este estudiante: 404, sin decir que es ajena.
      if (subject.group_id !== groupId) throw new HTTPException(404, { message: "Materia no encontrada" });

      const { data, error } = await db
        .from("guides")
        .select(GUIDE_COLUMNS)
        .eq("subject_id", subject.id)
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) throwSupabase(error);
      const all = (data ?? []) as GuideRow[];

      const term = q?.toLowerCase() ?? "";
      const items = all.filter((row) => {
        if (topic && row.topic !== topic) return false;
        if (term && !(row.title.toLowerCase().includes(term) || row.topic.toLowerCase().includes(term))) return false;
        return true;
      });

      return c.json({
        subject: await subjectCard(db, subject),
        // Los temas salen de las guías publicadas: son las fichas de filtro de la pantalla.
        topics: [...new Set(all.map((row) => row.topic))].sort((a, b) => a.localeCompare(b, "es")),
        // total es de todas las publicadas (sin filtrar), como el resumen de la lista del profesor.
        total: all.length,
        items: items.map(mapGuide),
      });
    },
  )
  // Detalle de una guía publicada (estudiante-03): lo que pinta el panel de la derecha.
  .get("/guides/:id", async (c) => {
    const db = supabaseAdmin();
    const { groupId } = c.get("student");
    const { guide, subject } = await findStudentGuide(db, c.req.param("id"), groupId);
    return c.json({ ...mapGuide(guide), subject: await subjectCard(db, subject) });
  });
