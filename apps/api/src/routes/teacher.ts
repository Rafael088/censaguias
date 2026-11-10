import { Hono } from "hono";
import { groupLabel, SHIFT_LABEL, type Shift } from "@censaguias/shared";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { throwSupabase } from "../lib/groups.js";

/** Cuántas guías trae la tabla «Tus guías recientes» de la pantalla profesor-01. */
const RECENT_GUIDES = 10;

type MySubjectRow = { id: string; name: string; group_id: string };
type MyGroupRow = { id: string; clei: number; identifier: string; shift: Shift; access_code: string };
type MyGuideRow = {
  id: string;
  subject_id: string;
  topic: string;
  title: string;
  status: "draft" | "published";
  updated_at: string | null;
};

/**
 * GET /v1/teacher/subjects — el espacio docente (profesor-01): sus materias con el grupo
 * al que pertenecen y cuántas guías tiene cada una publicadas y en borrador, más sus
 * últimas guías para la tabla «Tus guías recientes». Solo materias del profesor que pide:
 * el orden lo pone la API, el front solo pinta.
 */
export const teacherRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStaff("teacher"))
  .get("/subjects", async (c) => {
    const { id } = c.get("staff");
    const db = supabaseAdmin();

    const { data: subjectRows, error: subjectsError } = await db
      .from("subjects")
      .select("id, name, group_id")
      .eq("teacher_id", id)
      .order("name");
    if (subjectsError) throwSupabase(subjectsError);
    const subjects = (subjectRows ?? []) as MySubjectRow[];
    if (subjects.length === 0) return c.json({ subjects: [], recentGuides: [] });

    const { data: groupRows, error: groupsError } = await db
      .from("groups")
      .select("id, clei, identifier, shift, access_code")
      .in("id", [...new Set(subjects.map((subject) => subject.group_id))]);
    if (groupsError) throwSupabase(groupsError);
    const groupsById = new Map(((groupRows ?? []) as MyGroupRow[]).map((group) => [group.id, group]));

    // Las guías de todas las materias de una sola consulta: dan el conteo de cada tarjeta
    // y la de «recientes», sin una consulta por materia.
    const { data: guideRows, error: guidesError } = await db
      .from("guides")
      .select("id, subject_id, topic, title, status, updated_at")
      .in("subject_id", subjects.map((subject) => subject.id))
      .order("updated_at", { ascending: false });
    if (guidesError) throwSupabase(guidesError);
    const guides = (guideRows ?? []) as MyGuideRow[];

    const published = new Map<string, number>();
    const drafts = new Map<string, number>();
    for (const guide of guides) {
      const counter = guide.status === "published" ? published : drafts;
      counter.set(guide.subject_id, (counter.get(guide.subject_id) ?? 0) + 1);
    }

    const groupOf = (groupId: string) => {
      const group = groupsById.get(groupId);
      // label y jornada ya rotulados, igual que en /v1/me y /v1/access.
      return group
        ? {
            id: group.id,
            label: groupLabel(group),
            shift: group.shift,
            shiftLabel: SHIFT_LABEL[group.shift],
            accessCode: group.access_code,
          }
        : null;
    };
    const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]));

    return c.json({
      subjects: subjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        group: groupOf(subject.group_id),
        publishedGuides: published.get(subject.id) ?? 0,
        draftGuides: drafts.get(subject.id) ?? 0,
      })),
      recentGuides: guides.slice(0, RECENT_GUIDES).map((guide) => {
        const subject = subjectsById.get(guide.subject_id);
        return {
          id: guide.id,
          title: guide.title,
          topic: guide.topic,
          status: guide.status,
          updatedAt: guide.updated_at,
          subject: subject ? { id: subject.id, name: subject.name } : null,
          group: subject ? groupOf(subject.group_id) : null,
        };
      }),
    });
  });
