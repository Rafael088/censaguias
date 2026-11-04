import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase, type Seed } from "../lib/testing.js";
import { signStudentSession, STUDENT_COOKIE } from "../lib/student-session.js";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const LAURA = "bbbbbbbb-0000-4000-8000-000000000002";
const CARLOS = "bbbbbbbb-0000-4000-8000-000000000003";
const G1 = "cccccccc-0000-4000-8000-000000000010"; // CLEI IV · A, Mañana
const G2 = "cccccccc-0000-4000-8000-000000000011"; // CLEI V · B, Noche
const MATH = "dddddddd-0000-4000-8000-000000000101"; // G1, Laura
const LANG = "dddddddd-0000-4000-8000-000000000102"; // G1, Carlos
const SCI = "dddddddd-0000-4000-8000-000000000103"; // G1, sin docente
const PHYS = "dddddddd-0000-4000-8000-000000000104"; // G2, Laura
const G_ALG = "eeeeeeee-0000-4000-8000-000000000001";
const G_ARIT = "eeeeeeee-0000-4000-8000-000000000002";
const G_DRAFT = "eeeeeeee-0000-4000-8000-000000000003";
const G_LECT = "eeeeeeee-0000-4000-8000-000000000004";
const G_PHYS = "eeeeeeee-0000-4000-8000-000000000005";
const GONE = "ffffffff-0000-4000-8000-000000000099";

const GROUP_OF: Record<string, string> = { [MATH]: G1, [LANG]: G1, [SCI]: G1, [PHYS]: G2 };
const pdfPath = (subjectId: string, guideId: string) => `${GROUP_OF[subjectId]}/${subjectId}/${guideId}.pdf`;

const PROFILES: Seed["profiles"] = [
  { id: ADMIN, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
  { id: LAURA, username: "laura.martinez", full_name: "Laura Martínez", role: "teacher", active: true },
  { id: CARLOS, username: "carlos.rojas", full_name: "Carlos Rojas", role: "teacher", active: true },
];

const GROUPS: Seed["groups"] = [
  { id: G1, clei: 4, identifier: "A", shift: "morning", school_year: 2026, access_code: "CENSA-4AM-K7Q", code_version: 1 },
  { id: G2, clei: 5, identifier: "B", shift: "night", school_year: 2026, access_code: "CENSA-5BN-8TZ", code_version: 1 },
];

const SUBJECTS: Seed["subjects"] = [
  { id: MATH, group_id: G1, name: "Matemáticas", description: "Álgebra y operaciones", teacher_id: LAURA },
  { id: LANG, group_id: G1, name: "Lengua Castellana", description: "Lectura y escritura", teacher_id: CARLOS },
  { id: SCI, group_id: G1, name: "Ciencias Naturales", description: null, teacher_id: null },
  { id: PHYS, group_id: G2, name: "Física", description: "Mecánica", teacher_id: LAURA },
];

function guide(
  id: string,
  subjectId: string,
  topic: string,
  title: string,
  status: "draft" | "published",
  day: string,
  sizeBytes = 1_000_000,
  pageCount = 3,
) {
  return {
    id,
    subject_id: subjectId,
    topic,
    title,
    description: "Aprende paso a paso con ejemplos resueltos.",
    status,
    published_at: status === "published" ? `2026-10-${day}T08:00:00.000Z` : null,
    storage_path: pdfPath(subjectId, id),
    file_name: "guia.pdf",
    size_bytes: sizeBytes,
    page_count: pageCount,
    created_at: `2026-10-${day}T08:00:00.000Z`,
    updated_at: `2026-10-${day}T08:00:00.000Z`,
  };
}

const GUIDES: Seed["guides"] = [
  guide(G_ALG, MATH, "Álgebra", "Ecuaciones de primer grado", "published", "14", 1_800_000, 4),
  guide(G_ARIT, MATH, "Aritmética", "Operaciones con números enteros", "published", "12", 1_200_000, 3),
  guide(G_DRAFT, MATH, "Álgebra", "Guía sin publicar", "draft", "15"),
  guide(G_LECT, LANG, "Lectura", "Comprensión de textos", "published", "13", 1_400_000, 2),
  guide(G_PHYS, PHYS, "Mecánica", "Leyes de Newton", "published", "10"),
];

const STORAGE: Seed["storage"] = {
  guides: GUIDES.map((row) => row.storage_path as string),
};

async function withSeed(extra: Partial<Seed>, run: (client: FakeSupabase) => Promise<void>): Promise<void> {
  const client = fakeSupabase({
    profiles: PROFILES,
    groups: GROUPS,
    subjects: SUBJECTS,
    guides: structuredClone(GUIDES),
    storage: structuredClone(STORAGE),
    ...extra,
  });
  try {
    await run(client);
  } finally {
    client.restore();
  }
}

/** Cookie de estudiante firmada a mano, para simular un código regenerado. */
async function staleCookie(groupId: string, codeVersion: number): Promise<Record<string, string>> {
  return { Cookie: `${STUDENT_COOKIE}=${await signStudentSession({ groupId, codeVersion })}` };
}

afterAll(() => undefined);

describe("API-07 — rutas del estudiante", () => {
  describe("GET /v1/student/group", () => {
    it("pide el código de acceso: sin cookie responde 401", async () => {
      const res = await app.request("/v1/student/group");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Ingresa tu código de acceso" });
    });

    it("si el código se regeneró, la sesión vieja cae (401)", async () => {
      await withSeed({}, async () => {
        const res = await app.request("/v1/student/group", { headers: await staleCookie(G1, 99) });
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "El código ya no es válido" });
      });
    });

    it("devuelve el grupo, sus materias con docente y recuento, y las últimas publicadas", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request("/v1/student/group", { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.group).toEqual({
          id: G1,
          label: "CLEI IV · A",
          shift: "morning",
          shiftLabel: "Mañana",
          schoolYear: 2026,
          accessCode: "CENSA-4AM-K7Q",
        });

        // Orden alfabético; solo materias de SU grupo.
        expect(body.subjects).toEqual([
          { id: SCI, name: "Ciencias Naturales", description: null, teacher: null, publishedGuides: 0 },
          {
            id: LANG,
            name: "Lengua Castellana",
            description: "Lectura y escritura",
            teacher: { fullName: "Carlos Rojas" },
            publishedGuides: 1,
          },
          {
            id: MATH,
            name: "Matemáticas",
            description: "Álgebra y operaciones",
            teacher: { fullName: "Laura Martínez" },
            publishedGuides: 2,
          },
        ]);

        // Lo más reciente primero: sin borradores ni guías de otro grupo.
        expect(body.recentGuides.map((row: { id: string }) => row.id)).toEqual([G_ALG, G_LECT, G_ARIT]);
        expect(body.recentGuides[0]).toEqual({
          id: G_ALG,
          title: "Ecuaciones de primer grado",
          topic: "Álgebra",
          publishedAt: "2026-10-14T08:00:00.000Z",
          fileName: "guia.pdf",
          sizeBytes: 1_800_000,
          subject: { id: MATH, name: "Matemáticas" },
        });
        expect(body.totalPublishedGuides).toBe(3);
      });
    });

    it("un grupo sin materias sale con las listas vacías", async () => {
      await withSeed({ subjects: [], guides: [] }, async (client) => {
        const res = await app.request("/v1/student/group", { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          group: {
            id: G1,
            label: "CLEI IV · A",
            shift: "morning",
            shiftLabel: "Mañana",
            schoolYear: 2026,
            accessCode: "CENSA-4AM-K7Q",
          },
          subjects: [],
          recentGuides: [],
          totalPublishedGuides: 0,
        });
      });
    });
  });

  describe("GET /v1/student/subjects/:id/guides", () => {
    it("pide el código de acceso: sin cookie responde 401", async () => {
      const res = await app.request(`/v1/student/subjects/${MATH}/guides`);
      expect(res.status).toBe(401);
    });

    it("la materia de otro grupo no existe para este estudiante (404)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/subjects/${PHYS}/guides`, {
          headers: (await client.studentSession(G1)).headers,
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Materia no encontrada" });
      });
    });

    it("lista solo las publicadas, con sus temas y el total", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/subjects/${MATH}/guides`, {
          headers: (await client.studentSession(G1)).headers,
        });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.subject).toEqual({
          id: MATH,
          name: "Matemáticas",
          description: "Álgebra y operaciones",
          teacher: { fullName: "Laura Martínez" },
          group: {
            id: G1,
            label: "CLEI IV · A",
            shift: "morning",
            shiftLabel: "Mañana",
            schoolYear: 2026,
            accessCode: "CENSA-4AM-K7Q",
          },
        });
        expect(body.topics).toEqual(["Álgebra", "Aritmética"]);
        expect(body.total).toBe(2);
        expect(body.items.map((row: { id: string }) => row.id)).toEqual([G_ALG, G_ARIT]);
        // La card pinta descripción, archivo y páginas.
        expect(body.items[0]).toMatchObject({
          title: "Ecuaciones de primer grado",
          status: "published",
          fileName: "guia.pdf",
          sizeBytes: 1_800_000,
          pageCount: 4,
        });
      });
    });

    it("filtra por tema", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/subjects/${MATH}/guides?topic=Álgebra`, {
          headers: (await client.studentSession(G1)).headers,
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items.map((row: { id: string }) => row.id)).toEqual([G_ALG]);
        expect(body.total).toBe(2); // el total es de todas, el filtro solo acota los ítems
      });
    });

    it("busca por título o tema", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/subjects/${MATH}/guides?q=operaciones`, {
          headers: (await client.studentSession(G1)).headers,
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items.map((row: { id: string }) => row.id)).toEqual([G_ARIT]);
      });
    });
  });

  describe("GET /v1/student/guides/:id", () => {
    it("pide el código de acceso: sin cookie responde 401", async () => {
      const res = await app.request(`/v1/student/guides/${G_ALG}`);
      expect(res.status).toBe(401);
    });

    it("un borrador no se ve: 404", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/guides/${G_DRAFT}`, { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Guía no encontrada" });
      });
    });

    it("una guía de otro grupo no se ve: 404", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/guides/${G_PHYS}`, { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(404);
      });
    });

    it("devuelve la guía publicada con su materia, docente y grupo", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/guides/${G_ALG}`, { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({
          id: G_ALG,
          topic: "Álgebra",
          title: "Ecuaciones de primer grado",
          status: "published",
          publishedAt: "2026-10-14T08:00:00.000Z",
          fileName: "guia.pdf",
          sizeBytes: 1_800_000,
          pageCount: 4,
          subject: {
            id: MATH,
            name: "Matemáticas",
            teacher: { fullName: "Laura Martínez" },
            group: { label: "CLEI IV · A", shiftLabel: "Mañana", accessCode: "CENSA-4AM-K7Q" },
          },
        });
      });
    });
  });

  describe("GET /v1/guides/:id/file — descarga con URL firmada", () => {
    it("sin sesión responde 401", async () => {
      const res = await app.request(`/v1/guides/${G_ALG}/file`);
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Falta sesión" });
    });

    it("el estudiante abre una guía publicada de su grupo con URL de 60 segundos", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/guides/${G_ALG}/file`, { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.expiresIn).toBe(60);
        expect(body.url).toContain(`guides/${pdfPath(MATH, G_ALG)}`);
        expect(body.url).toContain("expiresIn=60");
      });
    });

    it("con download=1 la URL lleva el nombre del archivo", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/guides/${G_ALG}/file?download=1`, {
          headers: (await client.studentSession(G1)).headers,
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.url).toContain("download=guia.pdf");
      });
    });

    it("el estudiante no descarga borradores (404)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/guides/${G_DRAFT}/file`, { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(404);
      });
    });

    it("el estudiante no descarga guías de otro grupo (404)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/guides/${G_PHYS}/file`, { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(404);
      });
    });

    it("el profesor a cargo descarga la suya (200) y otro profesor no (403)", async () => {
      await withSeed({}, async (client) => {
        const owner = await app.request(`/v1/guides/${G_ALG}/file`, { headers: client.staffSession(LAURA).headers });
        expect(owner.status).toBe(200);

        const stranger = await app.request(`/v1/guides/${G_ALG}/file`, { headers: client.staffSession(CARLOS).headers });
        expect(stranger.status).toBe(403);
        expect(await stranger.json()).toEqual({ error: "Sin permiso" });
      });
    });

    it("el admin descarga cualquier guía", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/guides/${G_PHYS}/file`, { headers: client.staffSession(ADMIN).headers });
        expect(res.status).toBe(200);
      });
    });

    it("si Storage no deja firmar, responde 500", async () => {
      await withSeed({}, async (client) => {
        client.withStorageError("guides", "sign", { message: "storage caído" });
        const res = await app.request(`/v1/guides/${G_ALG}/file`, { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "Error interno" });
      });
    });
  });
});
