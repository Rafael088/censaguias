import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { Role } from "@censaguias/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { STUDENT_COOKIE, verifyStudentSession, type StudentSession } from "../lib/student-session.js";

export type Staff = { id: string; role: Role };
export type AppVars = { staff: Staff; student: StudentSession };

/** Admin o profesor: Bearer con el access_token de Supabase Auth. */
export const requireStaff = (...roles: Role[]) =>
  createMiddleware<{ Variables: AppVars }>(async (c, next) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
    if (!token) throw new HTTPException(401, { message: "Falta sesión" });

    const db = supabaseAdmin();
    const { data: user, error } = await db.auth.getUser(token);
    if (error || !user.user) throw new HTTPException(401, { message: "Sesión inválida" });

    const { data: profile } = await db.from("profiles").select("role, active").eq("id", user.user.id).single();
    if (!profile || !profile.active || (roles.length > 0 && !roles.includes(profile.role))) {
      throw new HTTPException(403, { message: "Sin permiso" });
    }
    c.set("staff", { id: user.user.id, role: profile.role });
    await next();
  });

/** Estudiante: cookie firmada que se obtuvo con el código de acceso. */
export const requireStudent = createMiddleware<{ Variables: AppVars }>(async (c, next) => {
  const token = getCookie(c, STUDENT_COOKIE);
  const session = token ? await verifyStudentSession(token) : null;
  if (!session) throw new HTTPException(401, { message: "Ingresa tu código de acceso" });

  const { data: group } = await supabaseAdmin()
    .from("groups")
    .select("code_version")
    .eq("id", session.groupId)
    .single();
  // Grupo eliminado o código regenerado → la sesión cae.
  if (!group || group.code_version !== session.codeVersion) {
    throw new HTTPException(401, { message: "El código ya no es válido" });
  }
  c.set("student", session);
  await next();
});
