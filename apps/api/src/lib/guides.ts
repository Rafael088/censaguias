import { HTTPException } from "hono/http-exception";
import type { SupabaseClient } from "@supabase/supabase-js";
import { throwSupabase } from "./groups.js";
import { findSubject, assertSubjectTeacher } from "./subjects.js";

export const GUIDE_COLUMNS =
  "id, subject_id, topic, title, description, status, published_at, storage_path, file_name, size_bytes, page_count, created_at, updated_at";

export type GuideRow = {
  id: string;
  subject_id: string;
  topic: string;
  title: string;
  description: string;
  status: "draft" | "published";
  published_at: string | null;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  page_count: number | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * La guía como la ve el front. Sin storage_path: eso es interno, la descarga va por una
 * URL firmada de corta vida (API-07).
 */
export const mapGuide = (row: GuideRow) => ({
  id: row.id,
  subjectId: row.subject_id,
  topic: row.topic,
  title: row.title,
  description: row.description,
  status: row.status,
  publishedAt: row.published_at,
  fileName: row.file_name,
  sizeBytes: row.size_bytes,
  pageCount: row.page_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La guía por su id, o 404. */
export async function findGuide(db: SupabaseClient, id: string): Promise<GuideRow> {
  if (!UUID.test(id)) throw new HTTPException(404, { message: "Guía no encontrada" });
  const { data, error } = await db.from("guides").select(GUIDE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throwSupabase(error);
  if (!data) throw new HTTPException(404, { message: "Guía no encontrada" });
  return data as GuideRow;
}

/**
 * La guía solo para el docente a cargo de su materia; si no es suya, 403, y si no
 * existe, 404. Todas las rutas de detalle/edición/borrado/publish pasan por aquí.
 */
export async function findOwnedGuide(db: SupabaseClient, id: string, staffId: string): Promise<GuideRow> {
  const guide = await findGuide(db, id);
  const subject = await findSubject(db, guide.subject_id);
  assertSubjectTeacher(subject, staffId);
  return guide;
}
