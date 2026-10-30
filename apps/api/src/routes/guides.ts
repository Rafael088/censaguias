import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { guideFields, guideListQuery, updateGuideInput, GUIDE_MIME } from "@censaguias/shared";
import { supabaseAdmin, GUIDES_BUCKET } from "../lib/supabase.js";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import { findSubject, assertSubjectTeacher } from "../lib/subjects.js";
import { GUIDE_COLUMNS, findOwnedGuide, mapGuide, type GuideRow } from "../lib/guides.js";
import { throwSupabase } from "../lib/groups.js";
import { countPdfPages, readPdfBytes, isPdfRejection } from "../lib/pdf.js";

// Guías de una materia: crear (multipart con el PDF) y listar (con filtros).
// Solo el docente a cargo de la materia. Se monta en /v1/subjects con /:id/guides dentro.
export const subjectGuideRoutes = new Hono<{ Variables: AppVars }>()
  .get(
    "/:id/guides",
    requireStaff("teacher"),
    zValidator("query", guideListQuery, (result, c) => {
      if (!result.success) return c.json({ error: "Filtros no válidos" }, 400);
    }),
    async (c) => {
      const { status, topic, q } = c.req.valid("query");
      const db = supabaseAdmin();
      const subject = await findSubject(db, c.req.param("id"));
      assertSubjectTeacher(subject, c.get("staff").id);

      const { data, error } = await db
        .from("guides")
        .select(GUIDE_COLUMNS)
        .eq("subject_id", subject.id)
        .order("created_at", { ascending: false });
      if (error) throwSupabase(error);
      const all = (data ?? []) as GuideRow[];

      // El resumen es de todas las guías de la materia, sin filtrar: es lo que enseña
      // la cabecera de la pantalla de guías («3 guías · 2 publicadas · 1 borrador»).
      const summary = {
        total: all.length,
        published: all.filter((row) => row.status === "published").length,
        drafts: all.filter((row) => row.status === "draft").length,
      };
      const term = q?.toLowerCase() ?? "";
      const items = all.filter((row) => {
        if (status && row.status !== status) return false;
        if (topic && row.topic !== topic) return false;
        if (term && !(row.title.toLowerCase().includes(term) || row.topic.toLowerCase().includes(term))) return false;
        return true;
      });
      return c.json({ items: items.map(mapGuide), summary });
    },
  )
  .post("/:id/guides", requireStaff("teacher"), async (c) => {
    const db = supabaseAdmin();
    const subject = await findSubject(db, c.req.param("id"));
    assertSubjectTeacher(subject, c.get("staff").id);

    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ error: "Falta el archivo PDF" }, 400);

    const parsed = guideFields.safeParse({
      topic: form.get("topic"),
      title: form.get("title"),
      description: form.get("description"),
      status: form.get("status"),
    });
    if (!parsed.success) return c.json({ error: "Datos de la guía no válidos" }, 400);
    const { topic, title, description, status } = parsed.data;

    const pdf = await readPdfBytes(file);
    if (isPdfRejection(pdf)) return c.json({ error: pdf.error }, pdf.status);
    const { bytes } = pdf;

    const guideId = crypto.randomUUID();
    const storagePath = `${subject.group_id}/${subject.id}/${guideId}.pdf`;
    const { error: uploadError } = await db.storage
      .from(GUIDES_BUCKET)
      .upload(storagePath, bytes, { contentType: GUIDE_MIME });
    if (uploadError) throwSupabase(uploadError);

    const { data, error } = await db
      .from("guides")
      .insert({
        id: guideId,
        subject_id: subject.id,
        topic,
        title,
        description,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
        storage_path: storagePath,
        file_name: file.name,
        size_bytes: file.size,
        page_count: countPdfPages(bytes),
        created_by: c.get("staff").id,
      })
      .select(GUIDE_COLUMNS)
      .single();
    if (error) {
      // La fila no se creó: se borra el PDF recién subido para no dejar huérfanos.
      await db.storage.from(GUIDES_BUCKET).remove([storagePath]);
      throwSupabase(error);
    }
    return c.json(mapGuide(data as GuideRow), 201);
  });

// Guías sueltas: detalle, editar (con el PDF opcional para reemplazarlo), eliminar (con
// su archivo) y publicar un borrador (pantallas profesor-04, 05 y 06). Se monta en /v1/guides.
// El middleware va por ruta, no con .use(): así API-07 podrá añadir aquí la descarga del
// PDF (que también sirve a estudiantes) sin heredar el filtro de profesor.
export const guideRoutes = new Hono<{ Variables: AppVars }>()
  .get("/:id", requireStaff("teacher"), async (c) => {
    const db = supabaseAdmin();
    const guide = await findOwnedGuide(db, c.req.param("id"), c.get("staff").id);
    return c.json(mapGuide(guide));
  })
  .patch("/:id", requireStaff("teacher"), async (c) => {
    const db = supabaseAdmin();
    const guide = await findOwnedGuide(db, c.req.param("id"), c.get("staff").id);

    const form = await c.req.formData();
    const update: Record<string, unknown> = {};
    for (const key of ["topic", "title", "description"] as const) {
      const value = form.get(key);
      if (typeof value === "string") update[key] = value;
    }
    const parsed = updateGuideInput.safeParse(update);
    if (!parsed.success) return c.json({ error: "Datos de la guía no válidos" }, 400);

    const file = form.get("file");
    if (file instanceof File) {
      const pdf = await readPdfBytes(file);
      if (isPdfRejection(pdf)) return c.json({ error: pdf.error }, pdf.status);
      // Se sube encima de la misma ruta (upsert): no cambia el id de la guía ni deja el
      // PDF viejo. Solo después se actualiza la fila con los datos del archivo nuevo.
      const { error: uploadError } = await db.storage
        .from(GUIDES_BUCKET)
        .upload(guide.storage_path, pdf.bytes, { contentType: GUIDE_MIME, upsert: true });
      if (uploadError) throwSupabase(uploadError);
      update.file_name = file.name;
      update.size_bytes = file.size;
      update.page_count = countPdfPages(pdf.bytes);
    }

    if (Object.keys(update).length === 0) return c.json({ error: "No se envió ningún cambio" }, 400);

    const { data, error } = await db.from("guides").update(update).eq("id", guide.id).select(GUIDE_COLUMNS);
    if (error) throwSupabase(error);
    const row = ((data ?? []) as GuideRow[])[0];
    if (!row) throw new HTTPException(404, { message: "Guía no encontrada" });
    return c.json(mapGuide(row));
  })
  .delete("/:id", requireStaff("teacher"), async (c) => {
    const db = supabaseAdmin();
    const guide = await findOwnedGuide(db, c.req.param("id"), c.get("staff").id);

    // La fila manda: al borrarla, Postgres borra la guía; el PDF se quita después, y si
    // Storage falla queda un archivo huérfano invisible (anotado en el log).
    const { data, error } = await db.from("guides").delete().eq("id", guide.id).select("id");
    if (error) throwSupabase(error);
    if (!data || (data as unknown[]).length === 0) throw new HTTPException(404, { message: "Guía no encontrada" });

    const { error: storageError } = await db.storage.from(GUIDES_BUCKET).remove([guide.storage_path]);
    if (storageError) console.error(`No se pudo borrar el PDF de la guía ${guide.id}:`, storageError);
    return c.body(null, 204);
  })
  .post("/:id/publish", requireStaff("teacher"), async (c) => {
    const db = supabaseAdmin();
    const guide = await findOwnedGuide(db, c.req.param("id"), c.get("staff").id);

    // Idempotente: si ya estaba publicada, se conserva la fecha de publicación original.
    const { data, error } = await db
      .from("guides")
      .update({ status: "published", published_at: guide.published_at ?? new Date().toISOString() })
      .eq("id", guide.id)
      .select(GUIDE_COLUMNS);
    if (error) throwSupabase(error);
    const row = ((data ?? []) as GuideRow[])[0];
    if (!row) throw new HTTPException(404, { message: "Guía no encontrada" });
    return c.json(mapGuide(row));
  });
