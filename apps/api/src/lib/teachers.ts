import { HTTPException } from "hono/http-exception";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SHIFT_LABEL, groupLabel, type Role } from "@censaguias/shared";
import { throwSupabase } from "./groups.js";

export const PROFILE_COLUMNS = "id, username, full_name, role, active, email, created_at";

export type ProfileRow = {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  active: boolean;
  email: string | null;
  created_at: string;
};

/** El perfil sin el correo ni nada de credenciales: la contraseña jamás sale de Auth (ADR 0006). */
export const mapProfile = (row: ProfileRow) => ({
  id: row.id,
  username: row.username,
  fullName: row.full_name,
  active: row.active,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id que no es uuid: Supabase contestaría con un error 500; aquí simplemente no existe. */
export function requireTeacherId(id: string): string {
  if (!UUID.test(id)) throw new HTTPException(404, { message: "Profesor no encontrado" });
  return id;
}

/**
 * El profesor por su id, o 404. Filtra por role=teacher: /v1/teachers es de docentes,
 * así que un id de admin no existe para este recurso (y no se revela que es un admin).
 */
export async function findTeacher(db: SupabaseClient, id: string): Promise<ProfileRow> {
  const teacherId = requireTeacherId(id);
  const { data, error } = await db
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", teacherId)
    .eq("role", "teacher")
    .maybeSingle();
  if (error) throwSupabase(error);
  if (!data) throw new HTTPException(404, { message: "Profesor no encontrado" });
  return data as ProfileRow;
}

type GroupRow = { id: string; clei: number; identifier: string; shift: "morning" | "night" | "saturday"; access_code: string };

/**
 * Las asignaciones del profesor (admin-09): sus materias, cada una con su grupo y su
 * código de acceso. Las materias sin grupo no salen (imposible: group_id es NOT NULL).
 */
export async function assignmentsOfTeacher(
  db: SupabaseClient,
  teacherId: string,
): Promise<
  Array<{
    subject: { id: string; name: string };
    group: { id: string; label: string; shift: "morning" | "night" | "saturday"; shiftLabel: string; accessCode: string };
  }>
> {
  const { data: subjects, error } = await db
    .from("subjects")
    .select("id, name, group_id")
    .eq("teacher_id", teacherId)
    .order("name");
  if (error) throwSupabase(error);
  const rows = (subjects ?? []) as { id: string; name: string; group_id: string }[];

  const groupIds = [...new Set(rows.map((row) => row.group_id))];
  if (groupIds.length === 0) return [];

  const { data: groups, error: groupsError } = await db.from("groups").select("id, clei, identifier, shift, access_code").in("id", groupIds);
  if (groupsError) throwSupabase(groupsError);
  const byId = new Map(((groups ?? []) as GroupRow[]).map((group) => [group.id, group]));

  return rows.map((subject) => {
    const group = byId.get(subject.group_id);
    // group_id es NOT NULL: si no está, algo falló y mejor que se vea como error.
    if (!group) throw new Error(`La materia ${subject.id} no tiene grupo`);
    return {
      subject: { id: subject.id, name: subject.name },
      group: {
        id: group.id,
        label: groupLabel(group),
        shift: group.shift,
        shiftLabel: SHIFT_LABEL[group.shift],
        accessCode: group.access_code,
      },
    };
  });
}

/**
 * Buscador de admin-08: «Buscar por nombre o usuario».
 * PostgREST pide una sola expresión OR separada por comas, así que comas y paréntesis
 * se tiran fuera (romperían la expresión). Espacios, puntos y acentos sí valen: el admin
 * busca «Laura Mart». Si no queda nada útil, no se filtra.
 */
export function teacherSearchExpression(input: string): string | null {
  const term = input.replace(/[,%()]/g, "").trim();
  if (term === "") return null;
  return `full_name.ilike.%${term}%,username.ilike.%${term}%`;
}
