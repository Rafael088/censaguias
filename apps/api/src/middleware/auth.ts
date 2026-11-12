import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { Role } from "@censaguias/shared";
import { supabaseAdmin } from "../lib/supabase.js";
import { STUDENT_COOKIE, verifyStudentSession, type StudentSession } from "../lib/student-session.js";

export type Staff = { id: string; username: string; fullName: string; role: Role };
export type AppVars = { staff: Staff; student: StudentSession };

/** El perfil tras validar el Bearer: 401 si el token no lo conoce Supabase, 403 si el perfil no sirve. */
async function resolveStaff(token: string, roles: Role[]): Promise<Staff> {
  const db = supabaseAdmin();
  const { data: user, error } = await db.auth.getUser(token);
  if (error || !user.user) throw new HTTPException(401, { message: "Sesión inválida" });

  // username y full_name viajan en el mismo perfil para que /v1/me no tenga que volver a leerlo.
  const { data: profile } = await db
    .from("profiles")
    .select("username, full_name, role, active")
    .eq("id", user.user.id)
    .single();
  if (!profile || !profile.active || (roles.length > 0 && !roles.includes(profile.role))) {
    throw new HTTPException(403, { message: "Sin permiso" });
  }
  return { id: user.user.id, username: profile.username, fullName: profile.full_name, role: profile.role };
}

/**
 * La sesión del estudiante tras verificar la cookie y que su grupo siga vigente:
 * grupo eliminado o código regenerado → null (las viejas caen, ADR 0004).
 */
async function studentFromToken(token: string | undefined): Promise<StudentSession | null> {
  if (!token) return null;
  const session = await verifyStudentSession(token);
  if (!session) return null;

  const { data: group } = await supabaseAdmin()
    .from("groups")
    .select("code_version")
    .eq("id", session.groupId)
    .maybeSingle();
  if (!group || group.code_version !== session.codeVersion) return null;
  return session;
}

/** Admin o profesor: Bearer con el access_token de Supabase Auth. */
export const requireStaff = (...roles: Role[]) =>
  createMiddleware<{ Variables: AppVars }>(async (c, next) => {
    const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
    if (!token) throw new HTTPException(401, { message: "Falta sesión" });
    c.set("staff", await resolveStaff(token, roles));
    await next();
  });

/** Estudiante: cookie firmada que se obtiene con el código de acceso. */
export const requireStudent = createMiddleware<{ Variables: AppVars }>(async (c, next) => {
  const token = getCookie(c, STUDENT_COOKIE);
  if (!token) throw new HTTPException(401, { message: "Ingresa tu código de acceso" });
  const session = await studentFromToken(token);
  if (!session) throw new HTTPException(401, { message: "El código ya no es válido" });
  c.set("student", session);
  await next();
});

/**
 * Para la descarga del PDF (API-07): estudiante con cookie o staff con Bearer.
 * Si trae Bearer y es staff válido, se evalúa como staff. Si el Bearer falla o no hay,
 * se intenta como estudiante con la cookie de sesión.
 */
export const requireStudentOrStaff = createMiddleware<{ Variables: AppVars }>(async (c, next) => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /, "");
  if (token) {
    try {
      c.set("staff", await resolveStaff(token, []));
      await next();
      return;
    } catch (err) {
      // Si el token Bearer es inválido (401), se intenta como estudiante con la cookie.
      // Si es 403 (sin permiso, ej. profesor desactivado), se mantiene el 403.
      if (!(err instanceof HTTPException) || err.status !== 401) throw err;
    }
  }
  // Sin Bearer válido: se intenta como estudiante con la cookie de sesión.
  const cookie = getCookie(c, STUDENT_COOKIE);
  if (!cookie) throw new HTTPException(401, { message: "Falta sesión" });
  const session = await studentFromToken(cookie);
  if (!session) throw new HTTPException(401, { message: "El código ya no es válido" });
  c.set("student", session);
  await next();
});
