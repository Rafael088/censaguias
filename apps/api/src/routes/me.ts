import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Role } from "@censaguias/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { requireStaff, type AppVars } from "../middleware/auth.js";

// GET /v1/me: lo que la cabecera y la barra lateral pintan del staff que entró.
// El rol sale de profiles (middleware), nunca del token ni del body (regla 7 de AGENTS.md).
export const meRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStaff())
  .get("/", async (c) => {
    const { id, role } = c.get("staff");
    const db = supabaseAdmin();

    const { data: profile, error } = await db
      .from("profiles")
      .select("username, full_name")
      .eq("id", id)
      .single();
    if (error || !profile) throw new HTTPException(401, { message: "Sesión inválida" });

    // El profesor necesita sus materias para navegar; el admin no tiene asignadas.
    // Aun sin .single(), supabase-js responde { data, error } (no un array).
    const { data: subjectsData } =
      role === "teacher"
        ? await db.from("subjects").select("id, name, group_id").eq("teacher_id", id)
        : { data: [] };

    return c.json({
      id,
      username: profile.username as string,
      fullName: profile.full_name as string,
      role: role as Role,
      subjects: (subjectsData as { id: string; name: string; group_id: string }[] | null ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        groupId: s.group_id,
      })),
    });
  });
