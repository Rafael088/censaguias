import { HTTPException } from "hono/http-exception";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwSupabase } from "./groups.js";

export const SUBJECT_COLUMNS = "id, group_id, name, description, teacher_id";

export type SubjectRow = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  teacher_id: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La materia por su id, o 404. */
export async function findSubject(db: SupabaseClient, id: string): Promise<SubjectRow> {
  if (!UUID.test(id)) throw new HTTPException(404, { message: "Materia no encontrada" });
  const { data, error } = await db.from("subjects").select(SUBJECT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throwSupabase(error);
  if (!data) throw new HTTPException(404, { message: "Materia no encontrada" });
  return data as SubjectRow;
}

/** Solo el docente dueño de la materia toca sus guías; si no, 403. */
export function assertSubjectTeacher(subject: SubjectRow, staffId: string): void {
  if (subject.teacher_id !== staffId) throw new HTTPException(403, { message: "Sin permiso" });
}
