import { Hono } from "hono";
import { groupLabel } from "@censaguias/shared";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";

type SubjectRow = { id: string; name: string; group_id: string };
type GroupRow = { id: string; clei: number; identifier: string };

/**
 * Quién soy: perfil, rol y, si es profesor, sus materias con el grupo al que pertenecen.
 * Es lo que el front necesita para el guard por rol y para la cabecera (ARQUITECTURA.md).
 */
export const meRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStaff())
  .get("/", async (c) => {
    const { id, username, fullName, role } = c.get("staff");
    const base = { id, username, fullName, role };
    if (role !== "teacher") return c.json({ ...base, subjects: [] });

    const db = supabaseAdmin();
    // El orden lo pone la API: el front solo pinta.
    const { data } = await db
      .from("subjects")
      .select("id, name, group_id")
      .eq("teacher_id", id)
      .order("name");
    const subjects = (data ?? []) as SubjectRow[];

    const groupIds = [...new Set(subjects.map((subject) => subject.group_id))];
    if (groupIds.length === 0) return c.json({ ...base, subjects: [] });

    const { data: groups } = await db.from("groups").select("id, clei, identifier").in("id", groupIds);
    const byId = new Map(((groups ?? []) as GroupRow[]).map((group) => [group.id, group]));

    return c.json({
      ...base,
      subjects: subjects.map((subject) => {
        const group = byId.get(subject.group_id);
        return {
          id: subject.id,
          name: subject.name,
          group: group ? { id: group.id, label: groupLabel(group) } : null,
        };
      }),
    });
  });