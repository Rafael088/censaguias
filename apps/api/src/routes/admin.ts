import { Hono } from "hono";
import { SHIFT_LABEL, type Shift } from "@censaguias/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import { GROUP_COLUMNS, countByGroup, mapGroup, throwSupabase, type GroupRow } from "../lib/groups.js";

const ALL_SHIFTS: Shift[] = ["morning", "night", "saturday"];

// GET /v1/admin/summary (admin-01): los cuatro números de la cabecera, cómo se reparten
// los grupos por jornada y los tres más recientes con su número de materias.
export const adminRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStaff("admin"))
  .get("/summary", async (c) => {
    const db = supabaseAdmin();

    // Todo cabe en memoria (son los datos de una institución): se leen las filas que hacen
    // falta para contar en la API y solo se pide con count a Postgres lo que es un simple total.
    const [groupsResult, subjectsResult, publishedResult, staffResult] = await Promise.all([
      db.from("groups").select(GROUP_COLUMNS),
      db.from("subjects").select("group_id, teacher_id"),
      db.from("guides").select("id", { count: "exact", head: true }).eq("status", "published"),
      db.from("profiles").select("id").eq("role", "teacher").eq("active", true),
    ]);
    if (groupsResult.error) throwSupabase(groupsResult.error);
    if (subjectsResult.error) throwSupabase(subjectsResult.error);
    if (publishedResult.error) throwSupabase(publishedResult.error);
    if (staffResult.error) throwSupabase(staffResult.error);

    const groups = (groupsResult.data ?? []) as GroupRow[];
    const subjects = (subjectsResult.data ?? []) as { group_id: string; teacher_id: string | null }[];
    const staff = (staffResult.data ?? []) as { id: string }[];
    const subjectsPerGroup = countByGroup(subjects);

    const total = groups.length;
    const shifts = ALL_SHIFTS.map((shift) => {
      const inShift = groups.filter((group) => group.shift === shift).length;
      return {
        shift,
        label: SHIFT_LABEL[shift],
        groups: inShift,
        // El Figma lo pinta con un decimal ("33,3 %"); el front decide cómo formatearlo.
        percent: total === 0 ? 0 : Math.round((inShift / total) * 1000) / 10,
      };
    });

    const activeIds = new Set(staff.map((person) => person.id));
    const assignedTeachers = new Set(
      subjects.map((subject) => subject.teacher_id).filter((id): id is string => id !== null && activeIds.has(id)),
    );

    const recentGroups = [...groups]
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
      .slice(0, 3)
      .map((group) => mapGroup(group, subjectsPerGroup[group.id] ?? 0));

    return c.json({
      groups: total,
      activeTeachers: staff.length,
      assignedTeachers: assignedTeachers.size,
      subjects: subjects.length,
      publishedGuides: publishedResult.count ?? 0,
      shifts,
      recentGroups,
    });
  });
