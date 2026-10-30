import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MAX_GUIDE_BYTES } from "@censaguias/shared";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase, type Row } from "../lib/testing.js";

const ADMIN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_OWNER = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER_TEACHER = "bbbbbbbb-0000-4000-8000-000000000003";
const G1 = "cccccccc-0000-4000-8000-000000000010";
const ALGEBRA = "dddddddd-0000-4000-8000-000000000101";
const CALCULUS = "dddddddd-0000-4000-8000-000000000102";
const MISSING_SUBJECT = "ffffffff-0000-4000-8000-000000000099";

// Guías de Álgebra (de TEACHER_OWNER): dos publicadas y un borrador, como en el Figma.
const DRAFT1 = "eeeeeeee-0000-4000-8000-000000000001";
const PUB1 = "eeeeeeee-0000-4000-8000-000000000002";
const PUB2 = "eeeeeeee-0000-4000-8000-000000000003";
const FOREIGN = "eeeeeeee-0000-4000-8000-000000000004";
const MISSING_GUIDE = "eeeeeeee-0000-4000-8000-0000000000ff";

const pdfPath = (subject: string, guide: string) => `${G1}/${subject}/${guide}.pdf`;

const SEED_GUIDES: Row[] = [
  {
    id: DRAFT1,
    subject_id: ALGEBRA,
    topic: "Ecuaciones",
    title: "Ecuaciones de segundo grado",
    description: "Resolución paso a paso",
    status: "draft",
    published_at: null,
    storage_path: pdfPath(ALGEBRA, DRAFT1),
    file_name: "borrador.pdf",
    size_bytes: 1024,
    page_count: 10,
    created_at: "2026-10-01T00:00:00.000Z",
    created_by: TEACHER_OWNER,
  },
  {
    id: PUB1,
    subject_id: ALGEBRA,
    topic: "Ecuaciones",
    title: "Factorización de polinomios",
    description: "Trinomios de la forma ax2 + bx + c",
    status: "published",
    published_at: "2026-10-10T00:00:00.000Z",
    storage_path: pdfPath(ALGEBRA, PUB1),
    file_name: "factorizacion.pdf",
    size_bytes: 2048,
    page_count: 12,
    created_at: "2026-10-10T00:00:00.000Z",
    created_by: TEACHER_OWNER,
  },
  {
    id: PUB2,
    subject_id: ALGEBRA,
    topic: "Funciones",
    title: "Funciones cuadráticas",
    description: "Vértice y raíces",
    status: "published",
    published_at: "2026-10-20T00:00:00.000Z",
    storage_path: pdfPath(ALGEBRA, PUB2),
    file_name: "funciones.pdf",
    size_bytes: 4096,
    page_count: 8,
    created_at: "2026-10-20T00:00:00.000Z",
    created_by: TEACHER_OWNER,
  },
  // De otra materia y de otro docente: no debe mezclarse nunca con las de Álgebra.
  {
    id: FOREIGN,
    subject_id: CALCULUS,
    topic: "Límites",
    title: "Límites laterales",
    description: "Guía de otra materia",
    status: "draft",
    published_at: null,
    storage_path: pdfPath(CALCULUS, FOREIGN),
    file_name: "ajena.pdf",
    size_bytes: 512,
    page_count: 5,
    created_at: "2026-10-15T00:00:00.000Z",
    created_by: OTHER_TEACHER,
  },
];

const SEED_FILES: string[] = [
  pdfPath(ALGEBRA, DRAFT1),
  pdfPath(ALGEBRA, PUB1),
  pdfPath(ALGEBRA, PUB2),
  pdfPath(CALCULUS, FOREIGN),
];

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
    subjects: [
      { id: ALGEBRA, group_id: G1, name: "Álgebra", description: null, teacher_id: TEACHER_OWNER },
      { id: CALCULUS, group_id: G1, name: "Cálculo", description: null, teacher_id: OTHER_TEACHER },
    ],
    guides: [],
    storage: { guides: [...SEED_FILES] },
  });
});

// Cada prueba parte de la misma semilla: editar/borrar/publicar no contamina a las demás.
beforeEach(() => {
  db.guides.splice(0, db.guides.length, ...SEED_GUIDES.map((row) => ({ ...row })));
  db.files.splice(0, db.files.length, ...SEED_FILES);
  db.removed.length = 0;
});

afterAll(() => {
  db.restore();
});

const PDF_TWO_PAGES = "%PDF-1.4\n/Type /Page\n/Type /Page\nendobj\n";

function pdfFile(name = "guia.pdf", type = "application/pdf", body: string = PDF_TWO_PAGES): File {
  return new File([body], name, { type });
}

type Session = { headers: Record<string, string> };

type GuideDto = {
  id: string;
  topic: string;
  title: string;
  status: string;
  publishedAt: string | null;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  storagePath?: string;
  storage_path?: string;
};

type ListDto = { items: GuideDto[]; summary: { total: number; published: number; drafts: number } };

function listGuides(session: Session, subjectId: string, query = "") {
  return app.request(`/v1/subjects/${subjectId}/guides${query}`, { headers: session.headers });
}

function guideRequest(method: string, session: Session, path: string, body?: BodyInit) {
  return app.request(`/v1/guides/${path}`, { method, headers: session.headers, body });
}

function patchForm(fields: { topic?: string; title?: string; description?: string } = {}, file?: File) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) form.set(key, value);
  if (file) form.set("file", file);
  return form;
}

describe("GET /v1/subjects/:id/guides — API-06: listar guías de una materia", () => {
  it("pide sesión de docente (401 sin token)", async () => {
    const res = await listGuides({ headers: {} }, ALGEBRA);
    expect(res.status).toBe(401);
  });

  it("rechaza al admin: las guías las lleva el profesor a cargo (403)", async () => {
    const res = await listGuides(db.staffSession(ADMIN_ID), ALGEBRA);
    expect(res.status).toBe(403);
  });

  it("rechaza a otro profesor que no es el dueño de la materia (403)", async () => {
    const res = await listGuides(db.staffSession(OTHER_TEACHER), ALGEBRA);
    expect(res.status).toBe(403);
  });

  it("devuelve 404 si la materia no existe", async () => {
    const res = await listGuides(db.staffSession(TEACHER_OWNER), MISSING_SUBJECT);
    expect(res.status).toBe(404);
  });

  it("200: devuelve guías de la materia, resumen sin filtrar y sin exponer la ruta de Storage", async () => {
    const res = await listGuides(db.staffSession(TEACHER_OWNER), ALGEBRA);
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListDto;
    expect(body.summary).toEqual({ total: 3, published: 2, drafts: 1 });
    // Más reciente primero.
    expect(body.items.map((item) => item.id)).toEqual([PUB2, PUB1, DRAFT1]);
    for (const item of body.items) {
      expect(item.storagePath).toBeUndefined();
      expect(item.storage_path).toBeUndefined();
    }
  });

  it("filtra por estado (borrador) y el resumen sigue siendo de todas", async () => {
    const res = await listGuides(db.staffSession(TEACHER_OWNER), ALGEBRA, "?status=draft");
    const body = (await res.json()) as ListDto;
    expect(body.items.map((item) => item.id)).toEqual([DRAFT1]);
    expect(body.summary).toEqual({ total: 3, published: 2, drafts: 1 });
  });

  it("filtra por estado (publicadas)", async () => {
    const res = await listGuides(db.staffSession(TEACHER_OWNER), ALGEBRA, "?status=published");
    const body = (await res.json()) as ListDto;
    expect(body.items.map((item) => item.id)).toEqual([PUB2, PUB1]);
  });

  it("filtra por tema", async () => {
    const res = await listGuides(db.staffSession(TEACHER_OWNER), ALGEBRA, "?topic=Ecuaciones");
    const body = (await res.json()) as ListDto;
    expect(body.items.map((item) => item.id).sort()).toEqual([PUB1, DRAFT1].sort());
  });

  it("busca por título o tema (q)", async () => {
    const res = await listGuides(db.staffSession(TEACHER_OWNER), ALGEBRA, "?q=Factorizaci%C3%B3n");
    const body = (await res.json()) as ListDto;
    expect(body.items.map((item) => item.id)).toEqual([PUB1]);
  });

  it("devuelve 400 si el estado no es válido", async () => {
    const res = await listGuides(db.staffSession(TEACHER_OWNER), ALGEBRA, "?status=otra");
    expect(res.status).toBe(400);
  });
});

describe("GET /v1/guides/:id — API-06: detalle de una guía", () => {
  it("pide sesión de docente (401 sin token)", async () => {
    const res = await guideRequest("GET", { headers: {} }, DRAFT1);
    expect(res.status).toBe(401);
  });

  it("rechaza a otro profesor que no es el dueño de la materia (403)", async () => {
    const res = await guideRequest("GET", db.staffSession(TEACHER_OWNER), FOREIGN);
    expect(res.status).toBe(403);
  });

  it("devuelve 404 si la guía no existe", async () => {
    const res = await guideRequest("GET", db.staffSession(TEACHER_OWNER), MISSING_GUIDE);
    expect(res.status).toBe(404);
  });

  it("200: devuelve la guía sin la ruta de Storage", async () => {
    const res = await guideRequest("GET", db.staffSession(TEACHER_OWNER), DRAFT1);
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDto;
    expect(body.id).toBe(DRAFT1);
    expect(body.topic).toBe("Ecuaciones");
    expect(body.status).toBe("draft");
    expect(body.storagePath).toBeUndefined();
    expect(body.storage_path).toBeUndefined();
  });
});

describe("PATCH /v1/guides/:id — API-06: editar guía", () => {
  it("pide sesión de docente (401 sin token)", async () => {
    const res = await guideRequest("PATCH", { headers: {} }, DRAFT1, patchForm({ title: "X" }));
    expect(res.status).toBe(401);
  });

  it("rechaza a otro profesor que no es el dueño de la materia (403)", async () => {
    const res = await guideRequest("PATCH", db.staffSession(OTHER_TEACHER), DRAFT1, patchForm({ title: "X" }));
    expect(res.status).toBe(403);
  });

  it("devuelve 400 si no se envía ningún cambio", async () => {
    const res = await guideRequest("PATCH", db.staffSession(TEACHER_OWNER), DRAFT1, patchForm());
    expect(res.status).toBe(400);
  });

  it("devuelve 400 si los campos no son válidos", async () => {
    const res = await guideRequest("PATCH", db.staffSession(TEACHER_OWNER), DRAFT1, patchForm({ title: "x" }));
    expect(res.status).toBe(400);
  });

  it("devuelve 413 si el PDF nuevo pesa más de 10 MB", async () => {
    const big = new File([new Uint8Array(MAX_GUIDE_BYTES + 1)], "grande.pdf", { type: "application/pdf" });
    const res = await guideRequest("PATCH", db.staffSession(TEACHER_OWNER), DRAFT1, patchForm({}, big));
    expect(res.status).toBe(413);
  });

  it("devuelve 400 si el archivo nuevo no es un PDF", async () => {
    const res = await guideRequest(
      "PATCH",
      db.staffSession(TEACHER_OWNER),
      DRAFT1,
      patchForm({}, pdfFile("guia.pdf", "text/plain")),
    );
    expect(res.status).toBe(400);
  });

  it("200: actualiza solo el texto y conserva el PDF actual", async () => {
    const res = await guideRequest(
      "PATCH",
      db.staffSession(TEACHER_OWNER),
      DRAFT1,
      patchForm({ title: "Nuevo título" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDto;
    expect(body.title).toBe("Nuevo título");
    expect(body.fileName).toBe("borrador.pdf");
    expect(body.pageCount).toBe(10);
  });

  it("200: reemplaza el PDF en la misma ruta (sin duplicar archivos) y recalcula los datos", async () => {
    const res = await guideRequest(
      "PATCH",
      db.staffSession(TEACHER_OWNER),
      DRAFT1,
      patchForm({}, pdfFile("nuevo.pdf")),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDto;
    expect(body.fileName).toBe("nuevo.pdf");
    expect(body.pageCount).toBe(2);
    expect(body.sizeBytes).toBeGreaterThan(0);
    // La ruta no cambia y no se añade una copia: se sube encima con upsert.
    expect(db.files.filter((path) => path === pdfPath(ALGEBRA, DRAFT1))).toHaveLength(1);
    expect(db.files).toHaveLength(SEED_FILES.length);
  });

  it("200: editar no cambia el estado ni la fecha de publicación", async () => {
    const res = await guideRequest(
      "PATCH",
      db.staffSession(TEACHER_OWNER),
      PUB1,
      patchForm({ description: "Descripción nueva" }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDto;
    expect(body.status).toBe("published");
    expect(body.publishedAt).toBe("2026-10-10T00:00:00.000Z");
  });

  it("si la subida del PDF falla, no se cambia la fila", async () => {
    db.withStorageError("guides", "upload", { message: "storage no disponible" });
    const res = await guideRequest(
      "PATCH",
      db.staffSession(TEACHER_OWNER),
      DRAFT1,
      patchForm({ title: "No debería guardarse" }, pdfFile()),
    );
    expect(res.status).toBe(500);
    expect(db.guides.find((row) => row.id === DRAFT1)?.title).toBe("Ecuaciones de segundo grado");
  });
});

describe("DELETE /v1/guides/:id — API-06: eliminar guía y su archivo", () => {
  it("pide sesión de docente (401 sin token)", async () => {
    const res = await guideRequest("DELETE", { headers: {} }, DRAFT1);
    expect(res.status).toBe(401);
  });

  it("rechaza a otro profesor que no es el dueño de la materia (403)", async () => {
    const res = await guideRequest("DELETE", db.staffSession(OTHER_TEACHER), DRAFT1);
    expect(res.status).toBe(403);
  });

  it("devuelve 404 si la guía no existe", async () => {
    const res = await guideRequest("DELETE", db.staffSession(TEACHER_OWNER), MISSING_GUIDE);
    expect(res.status).toBe(404);
  });

  it("204: borra la fila y el PDF del bucket", async () => {
    const res = await guideRequest("DELETE", db.staffSession(TEACHER_OWNER), DRAFT1);
    expect(res.status).toBe(204);
    expect(db.guides.find((row) => row.id === DRAFT1)).toBeUndefined();
    expect(db.files).not.toContain(pdfPath(ALGEBRA, DRAFT1));
    expect(db.removed).toContain(pdfPath(ALGEBRA, DRAFT1));
  });

  it("si Storage falla al borrar, la guía sí desaparece y el PDF queda huérfano", async () => {
    db.withStorageError("guides", "remove", { message: "storage no disponible" });
    const res = await guideRequest("DELETE", db.staffSession(TEACHER_OWNER), PUB1);
    expect(res.status).toBe(204);
    expect(db.guides.find((row) => row.id === PUB1)).toBeUndefined();
    expect(db.files).toContain(pdfPath(ALGEBRA, PUB1));
    expect(db.removed).not.toContain(pdfPath(ALGEBRA, PUB1));
  });
});

describe("POST /v1/guides/:id/publish — API-06: publicar borrador", () => {
  const publish = (session: Session, guideId: string) =>
    app.request(`/v1/guides/${guideId}/publish`, { method: "POST", headers: session.headers });

  it("pide sesión de docente (401 sin token)", async () => {
    const res = await publish({ headers: {} }, DRAFT1);
    expect(res.status).toBe(401);
  });

  it("rechaza a otro profesor que no es el dueño de la materia (403)", async () => {
    const res = await publish(db.staffSession(OTHER_TEACHER), DRAFT1);
    expect(res.status).toBe(403);
  });

  it("200: publica un borrador y fija published_at", async () => {
    const res = await publish(db.staffSession(TEACHER_OWNER), DRAFT1);
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDto;
    expect(body.status).toBe("published");
    expect(body.publishedAt).not.toBeNull();
  });

  it("200: publicar una guía ya publicada no cambia la fecha original", async () => {
    const res = await publish(db.staffSession(TEACHER_OWNER), PUB1);
    expect(res.status).toBe(200);
    const body = (await res.json()) as GuideDto;
    expect(body.status).toBe("published");
    expect(body.publishedAt).toBe("2026-10-10T00:00:00.000Z");
  });
});
