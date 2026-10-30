import { Hono } from "hono";
import { guideFields, GUIDE_MIME, MAX_GUIDE_BYTES } from "@censaguias/shared";
import { supabaseAdmin, GUIDES_BUCKET } from "../lib/supabase.js";
import { requireStaff, type AppVars } from "../middleware/auth.js";
import { findSubject, assertSubjectTeacher } from "../lib/subjects.js";
import { GUIDE_COLUMNS, mapGuide, type GuideRow } from "../lib/guides.js";
import { throwSupabase } from "../lib/groups.js";
import { countPdfPages } from "../lib/pdf.js";

// Guías de una materia: crear (multipart con el PDF). Solo el docente a cargo de la materia.
// Se monta en /v1/subjects con la ruta /:id/guides dentro.
export const subjectGuideRoutes = new Hono<{ Variables: AppVars }>()
  .post("/:id/guides", requireStaff("teacher"), async (c) => {
    const db = supabaseAdmin();
    const subject = await findSubject(db, c.req.param("id"));
    assertSubjectTeacher(subject, c.get("staff").id);

    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return c.json({ error: "Falta el archivo PDF" }, 400);
    if (file.size > MAX_GUIDE_BYTES) return c.json({ error: "El archivo debe pesar 10 MB o menos" }, 413);
    if (file.type !== GUIDE_MIME) return c.json({ error: "El archivo debe ser un PDF" }, 400);

    const parsed = guideFields.safeParse({
      topic: form.get("topic"),
      title: form.get("title"),
      description: form.get("description"),
      status: form.get("status"),
    });
    if (!parsed.success) return c.json({ error: "Datos de la guía no válidos" }, 400);
    const { topic, title, description, status } = parsed.data;

    // Se lee una sola vez: la firma %PDF, el nº de páginas y la subida usan los mismos bytes.
    const bytes = new Uint8Array(await file.arrayBuffer());
    // La firma van en el contenido, no en el nombre del archivo.
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    if (!isPdf) return c.json({ error: "El archivo no es un PDF válido" }, 400);

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
