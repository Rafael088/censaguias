import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignSubjectTeacherInput,
  createSubjectInput,
  updateSubjectInput,
} from "@censaguias/shared";
import { supabaseAdmin, GUIDES_BUCKET } from "../lib/supabase.js";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import { findGroup, subjectsOfGroup, throwSupabase, type SubjectDetail } from "../lib/groups.js";
import { findSubject, SUBJECT_COLUMNS, type SubjectRow } from "../lib/subjects.js";

/** El docente debe existir, ser profesor y estar activo; si no, 400. */
async function requireActiveTeacher(db: SupabaseClient, teacherId: string): Promise<void> {
  const { data, error } = await db.from("profiles").select("role, active").eq("id", teacherId).maybeSingle();
  if (error) throwSupabase(error);
  if (!data || data.role !== "teacher" || !data.active) {
    throw new HTTPException(400, { message: "El docente no existe o no está activo" });
  }
}

/** La materia con su docente y sus guías publicadas (la misma forma que el detalle de grupo). */
async function subjectDetail(db: SupabaseClient, subject: SubjectRow): Promise<SubjectDetail> {
  let teacher: SubjectDetail["teacher"] = null;
  if (subject.teacher_id) {
    const { data } = await db.from("profiles").select("full_name").eq("id", subject.teacher_id).maybeSingle();
    if (data) teacher = { id: subject.teacher_id, fullName: (data as { full_name: string }).full_name };
  }
  const { count } = await db
    .from("guides")
    .select("id", { count: "exact", head: true })
    .eq("subject_id", subject.id)
    .eq("status", "published");
  return {
    id: subject.id,
    name: subject.name,
    description: subject.description,
    teacher,
    publishedGuides: count ?? 0,
  };
}

/**
 * PDF de una materia: guides/{grupo}/{materia}/*.pdf, listados antes de borrar la fila.
 * Si Storage no deja listar, se lanza y el DELETE no llega a tocar nada.
 */
async function pdfPathsOfSubject(db: SupabaseClient, groupId: string, subjectId: string): Promise<string[]> {
  const folder = `${groupId}/${subjectId}`;
  const { data: files, error } = await db.storage.from(GUIDES_BUCKET).list(folder, { limit: 1000 });
  if (error) throwSupabase(error);
  return (files ?? []).filter((file) => file.id !== null).map((file) => `${folder}/${file.name}`);
}

// Materias de un grupo: listar y crear. Anidadas en el grupo (admin-05 y admin-06), solo admin.
// Se monta en /v1/groups con la ruta /:id/subjects dentro, para que el id del grupo tipie.
export const groupSubjectRoutes = new Hono<{ Variables: AppVars }>()
  .use(requireStaff("admin"))
  .get("/:id/subjects", async (c) => {
    const db = supabaseAdmin();
    const group = await findGroup(db, c.req.param("id"));
    return c.json({ items: await subjectsOfGroup(db, group.id) });
  })
  .post(
    "/:id/subjects",
    zValidator("json", createSubjectInput, (result, c) => {
      if (!result.success) return c.json({ error: "Datos de la materia no válidos" }, 400);
    }),
    async (c) => {
      const input = c.req.valid("json");
      const db = supabaseAdmin();
      const group = await findGroup(db, c.req.param("id"));
      await requireActiveTeacher(db, input.teacherId);

      const { data, error } = await db
        .from("subjects")
        .insert({
          group_id: group.id,
          name: input.name,
          description: input.description ?? null,
          teacher_id: input.teacherId,
        })
        .select(SUBJECT_COLUMNS)
        .single();
      // El grupo tiene unique (group_id, name): el nombre ya existe en ese grupo.
      if (error?.code === "23505") return c.json({ error: "Ya existe una materia con ese nombre en el grupo" }, 409);
      if (error) throwSupabase(error);
      return c.json(await subjectDetail(db, data as SubjectRow), 201);
    },
  );

// Materias sueltas: editar, cambiar el docente y eliminar (admin-07), solo admin.
export const subjectRoutes = new Hono<{ Variables: AppVars }>()
  .patch(
    "/:id",
    requireStaff("admin"),
    zValidator("json", updateSubjectInput, (result, c) => {
      if (!result.success) return c.json({ error: "Datos de la materia no válidos" }, 400);
    }),
    async (c) => {
      const input = c.req.valid("json");
      const db = supabaseAdmin();
      const subject = await findSubject(db, c.req.param("id"));

      const changes: Record<string, unknown> = {};
      if (input.name !== undefined) changes.name = input.name;
      if (input.description !== undefined) changes.description = input.description; // puede ser null para quitarla
      if (Object.keys(changes).length === 0) return c.json({ error: "No se envió ningún cambio" }, 400);

      const { data, error } = await db.from("subjects").update(changes).eq("id", subject.id).select(SUBJECT_COLUMNS);
      if (error?.code === "23505") return c.json({ error: "Ya existe una materia con ese nombre en el grupo" }, 409);
      if (error) throwSupabase(error);
      const row = ((data ?? []) as SubjectRow[])[0];
      if (!row) throw new HTTPException(404, { message: "Materia no encontrada" });
      return c.json(await subjectDetail(db, row));
    },
  )
  .put(
    "/:id/teachers",
    requireStaff("admin"),
    zValidator("json", assignSubjectTeacherInput, (result, c) => {
      if (!result.success) return c.json({ error: "Docente no válido" }, 400);
    }),
    async (c) => {
      const input = c.req.valid("json");
      const db = supabaseAdmin();
      const subject = await findSubject(db, c.req.param("id"));
      if (input.teacherId !== null) await requireActiveTeacher(db, input.teacherId);

      const { data, error } = await db
        .from("subjects")
        .update({ teacher_id: input.teacherId })
        .eq("id", subject.id)
        .select(SUBJECT_COLUMNS);
      if (error) throwSupabase(error);
      const row = ((data ?? []) as SubjectRow[])[0];
      if (!row) throw new HTTPException(404, { message: "Materia no encontrada" });
      return c.json(await subjectDetail(db, row));
    },
  )
  .delete("/:id", requireStaff("admin"), async (c) => {
    const db = supabaseAdmin();
    const subject = await findSubject(db, c.req.param("id"));

    // Los PDF se piden antes de tocar nada: si Storage no contesta, no se borra nada.
    const paths = await pdfPathsOfSubject(db, subject.group_id, subject.id);

    // La fila manda: al borrarla, Postgres cascada a las guías. Los PDF se quitan después,
    // y si Storage falla quedan archivos huérfanos invisibles en el bucket (anotados en el log).
    const { data, error } = await db.from("subjects").delete().eq("id", subject.id).select("id");
    if (error) throwSupabase(error);
    if (!data || (data as unknown[]).length === 0) throw new HTTPException(404, { message: "Materia no encontrada" });

    if (paths.length > 0) {
      const { error: storageError } = await db.storage.from(GUIDES_BUCKET).remove(paths);
      if (storageError) console.error(`No se pudieron borrar los PDF de la materia ${subject.id}:`, storageError);
    }
    return c.body(null, 204);
  });
