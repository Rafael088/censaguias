import { HTTPException } from "hono/http-exception";
import type { SupabaseClient } from "@supabase/supabase-js";
import { groupLabel, SHIFT_LABEL, type Shift } from "@censaguias/shared";
import { GUIDES_BUCKET } from "./supabase.js";

/**
 * Un error de Supabase (PostgREST o Storage) es un objeto plano y Hono solo manda a
 * `onError` lo que es `Error`: sin este envoltorio, un fallo de la base se escaparía
 * como excepción sin respuesta.
 */
export function throwSupabase(error: { message: string; details?: string }): never {
  throw new Error(`Supabase: ${error.message}${error.details ? ` (${error.details})` : ""}`);
}

/** Columnas de public.groups que lee la API (nombres de la migración). */
export const GROUP_COLUMNS = "id, clei, identifier, shift, school_year, access_code, code_version, created_at";

export type GroupRow = {
  id: string;
  clei: number;
  identifier: string;
  shift: Shift;
  school_year: number;
  access_code: string;
  code_version: number;
  created_at?: string;
};

/** Materias de admin-05: su docente y cuántas guías publicadas tiene. */
export type SubjectDetail = {
  id: string;
  name: string;
  description: string | null;
  teacher: { id: string; fullName: string } | null;
  publishedGuides: number;
};

/**
 * Grupo como lo ve el front: etiqueta y jornada ya rotuladas (lo mismo que hace /v1/access).
 * `subjects` es el número de materias (en las listas) o la lista de materias (en el detalle).
 */
export const mapGroup = (row: GroupRow, subjects: number | SubjectDetail[] = 0) => ({
  id: row.id,
  clei: row.clei,
  identifier: row.identifier,
  label: groupLabel(row),
  shift: row.shift,
  shiftLabel: SHIFT_LABEL[row.shift],
  schoolYear: row.school_year,
  accessCode: row.access_code,
  codeVersion: row.code_version,
  subjects,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id que no es uuid: Supabase contestaría con un error 500; aquí simplemente no existe. */
export function requireGroupId(id: string): string {
  if (!UUID.test(id)) throw new HTTPException(404, { message: "Grupo no encontrado" });
  return id;
}

/** El grupo por su id, o 404. */
export async function findGroup(db: SupabaseClient, id: string): Promise<GroupRow> {
  const groupId = requireGroupId(id);
  const { data, error } = await db.from("groups").select(GROUP_COLUMNS).eq("id", groupId).maybeSingle();
  if (error) throwSupabase(error);
  if (!data) throw new HTTPException(404, { message: "Grupo no encontrado" });
  return data as GroupRow;
}

/** Materias por grupo, contadas sobre las filas ya leídas. */
export function countByGroup(rows: { group_id: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.group_id] = (counts[row.group_id] ?? 0) + 1;
  return counts;
}

/** Lo mismo leyendo solo esas materias: una consulta para toda la página, sin N+1. */
export async function subjectsCountByGroup(db: SupabaseClient, groupIds: string[]): Promise<Record<string, number>> {
  if (groupIds.length === 0) return {};
  const { data, error } = await db.from("subjects").select("group_id").in("group_id", groupIds);
  if (error) throwSupabase(error);
  return countByGroup((data ?? []) as { group_id: string }[]);
}

/** Materias del grupo con su docente y sus guías publicadas (pantalla admin-05). */
export async function subjectsOfGroup(db: SupabaseClient, groupId: string): Promise<SubjectDetail[]> {
  const { data: rows, error } = await db
    .from("subjects")
    .select("id, name, description, teacher_id")
    .eq("group_id", groupId)
    .order("name", { ascending: true });
  if (error) throwSupabase(error);

  const subjects = (rows ?? []) as {
    id: string;
    name: string;
    description: string | null;
    teacher_id: string | null;
  }[];
  if (subjects.length === 0) return [];

  const teacherNames = new Map<string, string>();
  const teacherIds = [...new Set(subjects.map((subject) => subject.teacher_id).filter((id): id is string => id !== null))];
  if (teacherIds.length > 0) {
    const { data: teachers, error: teachersError } = await db.from("profiles").select("id, full_name").in("id", teacherIds);
    if (teachersError) throwSupabase(teachersError);
    for (const teacher of (teachers ?? []) as { id: string; full_name: string }[]) {
      teacherNames.set(teacher.id, teacher.full_name);
    }
  }

  // El conteo sale de las guías de estas materias, una consulta para todas.
  const { data: guides, error: guidesError } = await db
    .from("guides")
    .select("subject_id, status")
    .in("subject_id", subjects.map((subject) => subject.id));
  if (guidesError) throwSupabase(guidesError);
  const published = new Map<string, number>();
  for (const guide of (guides ?? []) as { subject_id: string; status: string }[]) {
    if (guide.status === "published") published.set(guide.subject_id, (published.get(guide.subject_id) ?? 0) + 1);
  }

  return subjects.map((subject) => {
    const fullName = subject.teacher_id ? teacherNames.get(subject.teacher_id) : undefined;
    return {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      teacher: subject.teacher_id && fullName ? { id: subject.teacher_id, fullName } : null,
      publishedGuides: published.get(subject.id) ?? 0,
    };
  });
}

/**
 * Todos los PDF de un grupo, como rutas completas: guides/{grupo}/{materia}/{guía}.pdf.
 * Storage solo lista de una en una, así que se bajan los dos niveles que hay.
 * Si algo no se puede listar, se lanza y el DELETE no llega a tocar la fila.
 */
export async function pdfPathsOfGroup(db: SupabaseClient, groupId: string): Promise<string[]> {
  const storage = db.storage.from(GUIDES_BUCKET);
  const { data: entries, error } = await storage.list(groupId, { limit: 1000 });
  if (error) throwSupabase(error);

  const paths: string[] = [];
  for (const entry of entries ?? []) {
    if (entry.id !== null) {
      // Un archivo suelto en la raíz del grupo: no debería haberlo, pero se borra igual.
      paths.push(`${groupId}/${entry.name}`);
      continue;
    }
    const folder = `${groupId}/${entry.name}`;
    const { data: files, error: filesError } = await storage.list(folder, { limit: 1000 });
    if (filesError) throwSupabase(filesError);
    for (const file of files ?? []) {
      if (file.id !== null) paths.push(`${folder}/${file.name}`);
    }
  }
  return paths;
}

/** "CLEI IV", "iv", "4" → 4. Cualquier otra cosa no nombra un CLEI y se ignora. */
function parseClei(input: string): number | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^CLEI/, "");
  if (/^[1-6]$/.test(cleaned)) return Number(cleaned);
  const roman: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  return roman[cleaned] ?? null;
}

/**
 * Buscador de admin-02: «Buscar por CLEI, grupo o código».
 * PostgREST pide una sola expresión OR separada por comas, así que lo que no sea letra,
 * número o guion se tira fuera: una coma dentro de `q` rompería la expresión.
 * Si no queda nada útil, devuelve null y no se filtra (mejor no filtrar que no devolver nada).
 */
export function groupSearchExpression(input: string): string | null {
  const term = input.replace(/[^A-Za-z0-9-]/g, "");
  if (term === "") return null;

  const parts = [`access_code.ilike.%${term}%`, `identifier.ilike.%${term}%`];
  const clei = parseClei(input);
  if (clei !== null) parts.push(`clei.eq.${clei}`);
  return parts.join(",");
}
