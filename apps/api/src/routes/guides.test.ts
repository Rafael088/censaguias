import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_GUIDE_BYTES } from "@censaguias/shared";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase } from "../lib/testing.js";

const ADMIN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_OWNER = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER_TEACHER = "bbbbbbbb-0000-4000-8000-000000000003";
const G1 = "cccccccc-0000-4000-8000-000000000010";
const ALGEBRA = "dddddddd-0000-4000-8000-000000000101";
const GONE = "ffffffff-0000-4000-8000-000000000099";

let db: FakeSupabase;

beforeAll(() => {
  db = fakeSupabase({
    profiles: [
      { id: ADMIN_ID, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
      { id: TEACHER_OWNER, username: "luis.docente", full_name: "Luis Docente", role: "teacher", active: true },
      { id: OTHER_TEACHER, username: "carlos.docente", full_name: "Carlos Docente", role: "teacher", active: true },
    ],
    groups: [
      {
        id: G1,
        clei: 4,
        identifier: "A",
        shift: "morning",
        school_year: 2026,
        access_code: "CENSA-4AM-K7Q",
        code_version: 1,
      },
    ],
    subjects: [{ id: ALGEBRA, group_id: G1, name: "Álgebra", description: null, teacher_id: TEACHER_OWNER }],
    guides: [],
    storage: { guides: [] },
  });
});

afterAll(() => {
  db.restore();
});

const PDF_TWO_PAGES = "%PDF-1.4\n/Type /Page\n/Type /Page\nendobj\n";

function pdfFile(name = "guia.pdf", type = "application/pdf", body: string = PDF_TWO_PAGES): File {
  return new File([body], name, { type });
}

async function upload(
  session: { headers: Record<string, string> },
  subjectId: string,
  fields: { topic?: string; title?: string; description?: string; status?: string } = {},
  file?: File | null,
) {
  const form = new FormData();
  // `null` explícito = sin archivo; undefined = el PDF bueno por defecto.
  if (file !== null) form.set("file", file ?? pdfFile());
  form.set("topic", fields.topic ?? "Ecuaciones");
  form.set("title", fields.title ?? "Ecuaciones de segundo grado");
  form.set("description", fields.description ?? "Resolución paso a paso");
  form.set("status", fields.status ?? "draft");
  return app.request(`/v1/subjects/${subjectId}/guides`, { method: "POST", headers: session.headers, body: form });
}

describe("POST /v1/subjects/:id/guides — API-05: subir guía (multipart, PDF)", () => {
  it("pide sesión de docente (401 sin token)", async () => {
    const res = await upload({ headers: {} }, ALGEBRA);
    expect(res.status).toBe(401);
  });

  it("rechaza al admin: las guías las sube el profesor a cargo (403)", async () => {
    const res = await upload(db.staffSession(ADMIN_ID), ALGEBRA);
    expect(res.status).toBe(403);
  });

  it("devuelve 404 si la materia no existe", async () => {
    const res = await upload(db.staffSession(TEACHER_OWNER), GONE);
    expect(res.status).toBe(404);
  });

  it("rechaza a otro profesor que no es el dueño de la materia (403)", async () => {
    const res = await upload(db.staffSession(OTHER_TEACHER), ALGEBRA);
    expect(res.status).toBe(403);
  });

  it("devuelve 400 si falta el archivo", async () => {
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA, {}, null);
    expect(res.status).toBe(400);
  });

  it("devuelve 413 si el PDF pesa más de 10 MB", async () => {
    const big = new File([new Uint8Array(MAX_GUIDE_BYTES + 1)], "grande.pdf", { type: "application/pdf" });
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA, {}, big);
    expect(res.status).toBe(413);
  });

  it("devuelve 400 si el archivo no es application/pdf", async () => {
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA, {}, pdfFile("guia.pdf", "text/plain"));
    expect(res.status).toBe(400);
  });

  it("devuelve 400 si el contenido no empieza por %PDF", async () => {
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA, {}, pdfFile("guia.pdf", "application/pdf", "hola"));
    expect(res.status).toBe(400);
  });

  it("devuelve 400 si los campos de la guía no son válidos", async () => {
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA, { topic: "x" });
    expect(res.status).toBe(400);
  });

  it("201: guarda el borrador, sube el PDF a su ruta y calcula page_count", async () => {
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA);
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      subjectId: string;
      topic: string;
      status: string;
      publishedAt: string | null;
      pageCount: number | null;
      fileName: string;
      sizeBytes: number;
    };
    expect(body.subjectId).toBe(ALGEBRA);
    expect(body.topic).toBe("Ecuaciones");
    expect(body.status).toBe("draft");
    expect(body.publishedAt).toBeNull();
    expect(body.pageCount).toBe(2);
    expect(body.fileName).toBe("guia.pdf");
    expect(body.sizeBytes).toBeGreaterThan(0);
    // El PDF quedó en guides/{grupo}/{materia}/{id}.pdf (la ruta de la ADR 0005).
    expect(db.files).toContain(`${G1}/${ALGEBRA}/${body.id}.pdf`);
  });

  it("201: al publicar, fija published_at", async () => {
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA, { status: "published" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { status: string; publishedAt: string | null };
    expect(body.status).toBe("published");
    expect(body.publishedAt).not.toBeNull();
  });

  it("si la inserción falla, borra el PDF recién subido (no deja huérfanos)", async () => {
    const removedBefore = db.removed.length;
    db.withError("guides", { message: "boom" }, { op: "insert" });
    const res = await upload(db.staffSession(TEACHER_OWNER), ALGEBRA);
    expect(res.status).toBe(500);
    // El PDF se subió y, al caerse la fila, se quitó del bucket.
    expect(db.removed.length).toBe(removedBefore + 1);
    expect(db.removed.at(-1)).toBe(`${G1}/${ALGEBRA}/${db.removed.at(-1)?.split("/").pop()}`);
    expect(db.removed.at(-1)).toMatch(
      new RegExp(`^${G1}/${ALGEBRA}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.pdf$`),
    );
  });
});
