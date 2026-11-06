import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase, type Seed } from "../lib/testing.js";
import { signStudentSession, STUDENT_COOKIE } from "../lib/student-session.js";

// API-09 — permisos de punta a punta (issue #11): un profesor no toca materias ajenas,
// un estudiante no ve otro grupo ni los borradores, un código regenerado o un grupo
// eliminado invalidan la sesión, y un profesor desactivado no entra. Va por matriz de
// rutas para que una ruta nueva sin permiso falle aquí en cuanto se añada.

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const LAURA = "bbbbbbbb-0000-4000-8000-000000000002"; // dueña de Matemáticas (G1)
const CARLOS = "bbbbbbbb-0000-4000-8000-000000000003"; // dueño de Lengua (G1), ajeno a Matemáticas
const DE_BAJA = "bbbbbbbb-0000-4000-8000-000000000004"; // profesor desactivado
const G1 = "cccccccc-0000-4000-8000-000000000010"; // CLEI IV · A — el del estudiante
const G2 = "cccccccc-0000-4000-8000-000000000011"; // CLEI V · B — otro grupo
const MATH = "dddddddd-0000-4000-8000-000000000101"; // G1, Laura
const LANG = "dddddddd-0000-4000-8000-000000000102"; // G1, Carlos
const SCI = "dddddddd-0000-4000-8000-000000000103"; // G2, sin docente
const PUB = "eeeeeeee-0000-4000-8000-000000000001"; // MATH, publicada
const DRAFT = "eeeeeeee-0000-4000-8000-000000000002"; // MATH, borrador
const PUB_LANG = "eeeeeeee-0000-4000-8000-000000000003"; // LANG, publicada
const PUB_SCI = "eeeeeeee-0000-4000-8000-000000000004"; // SCI (G2), publicada

const PROFILES: Seed["profiles"] = [
  { id: ADMIN, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
  { id: LAURA, username: "laura.martinez", full_name: "Laura Martínez", role: "teacher", active: true },
  { id: CARLOS, username: "carlos.rojas", full_name: "Carlos Rojas", role: "teacher", active: true },
  { id: DE_BAJA, username: "profesor.baja", full_name: "Profe De Baja", role: "teacher", active: false },
];

const GROUPS: Seed["groups"] = [
  { id: G1, clei: 4, identifier: "A", shift: "morning", school_year: 2026, access_code: "CENSA-4AM-K7Q", code_version: 1 },
  { id: G2, clei: 5, identifier: "B", shift: "night", school_year: 2026, access_code: "CENSA-5BN-8TZ", code_version: 1 },
];

const SUBJECTS: Seed["subjects"] = [
  { id: MATH, group_id: G1, name: "Matemáticas", description: "Álgebra y operaciones", teacher_id: LAURA },
  { id: LANG, group_id: G1, name: "Lengua Castellana", description: null, teacher_id: CARLOS },
  { id: SCI, group_id: G2, name: "Ciencias Naturales", description: null, teacher_id: null },
];

/** Guía con su PDF en la ruta que calcula la API: {grupo}/{materia}/{guía}.pdf. */
function guide(
  id: string,
  subjectId: string,
  groupId: string,
  status: "draft" | "published",
  day: string,
  topic: string,
  title: string,
) {
  return {
    id,
    subject_id: subjectId,
    topic,
    title,
    description: "Guía de prueba para el test de permisos.",
    status,
    published_at: status === "published" ? `2026-10-${day}T08:00:00.000Z` : null,
    storage_path: `${groupId}/${subjectId}/${id}.pdf`,
    file_name: "guia.pdf",
    size_bytes: 1_800_000,
    page_count: 4,
    created_at: `2026-10-${day}T08:00:00.000Z`,
    updated_at: `2026-10-${day}T08:00:00.000Z`,
  };
}

const GUIDES: Seed["guides"] = [
  guide(PUB, MATH, G1, "published", "14", "Álgebra", "Ecuaciones de primer grado"),
  guide(DRAFT, MATH, G1, "draft", "15", "Álgebra", "Guía sin publicar"),
  guide(PUB_LANG, LANG, G1, "published", "12", "Lectura", "Comprensión de textos"),
  guide(PUB_SCI, SCI, G2, "published", "10", "Biología", "Células y tejidos"),
];

const STORAGE: Seed["storage"] = { guides: GUIDES.map((row) => row.storage_path as string) };

/** Cada prueba parte de la misma semilla: nadie arrastra el estado de otra. */
async function withSeed(extra: Partial<Seed>, run: (client: FakeSupabase) => Promise<void>): Promise<void> {
  const client = fakeSupabase({
    profiles: structuredClone(PROFILES),
    groups: structuredClone(GROUPS),
    subjects: structuredClone(SUBJECTS),
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

type Ruta = { metodo: string; ruta: string; body?: unknown };

const llamar = (ruta: Ruta, headers: Record<string, string>) =>
  app.request(
    ruta.ruta,
    ruta.body === undefined
      ? { method: ruta.metodo, headers }
      : { method: ruta.metodo, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(ruta.body) },
  );

/** Las rutas de gestión de guías sobre una materia de Laura (issue #11). */
const RUTAS_DE_GUIA: Ruta[] = [
  { metodo: "GET", ruta: `/v1/subjects/${MATH}/guides` },
  { metodo: "POST", ruta: `/v1/subjects/${MATH}/guides` },
  { metodo: "GET", ruta: `/v1/guides/${PUB}` },
  { metodo: "PATCH", ruta: `/v1/guides/${PUB}` },
  { metodo: "DELETE", ruta: `/v1/guides/${PUB}` },
  { metodo: "POST", ruta: `/v1/guides/${PUB}/publish` },
  { metodo: "GET", ruta: `/v1/guides/${PUB}/file` },
];

/** Todo el catálogo de rutas de staff, para probar quién entra y quién no. */
const RUTAS_STAFF: Ruta[] = [
  { metodo: "GET", ruta: "/v1/me" },
  { metodo: "GET", ruta: "/v1/admin/summary" },
  { metodo: "GET", ruta: "/v1/groups" },
  { metodo: "POST", ruta: "/v1/groups", body: { clei: 4, identifier: "Z", shift: "morning", schoolYear: 2027 } },
  { metodo: "GET", ruta: `/v1/groups/${G1}` },
  { metodo: "PATCH", ruta: `/v1/groups/${G1}`, body: { schoolYear: 2027 } },
  { metodo: "DELETE", ruta: `/v1/groups/${G1}` },
  { metodo: "POST", ruta: `/v1/groups/${G1}/code` },
  { metodo: "GET", ruta: `/v1/groups/${G1}/subjects` },
  { metodo: "POST", ruta: `/v1/groups/${G1}/subjects`, body: { name: "Química", teacherId: LAURA } },
  { metodo: "PATCH", ruta: `/v1/subjects/${MATH}`, body: { name: "Matemáticas II" } },
  { metodo: "PUT", ruta: `/v1/subjects/${MATH}/teachers`, body: { teacherId: CARLOS } },
  { metodo: "DELETE", ruta: `/v1/subjects/${MATH}` },
  { metodo: "GET", ruta: `/v1/subjects/${MATH}/guides` },
  { metodo: "POST", ruta: `/v1/subjects/${MATH}/guides` },
  { metodo: "GET", ruta: `/v1/guides/${PUB}` },
  { metodo: "PATCH", ruta: `/v1/guides/${PUB}` },
  { metodo: "DELETE", ruta: `/v1/guides/${PUB}` },
  { metodo: "POST", ruta: `/v1/guides/${PUB}/publish` },
  { metodo: "GET", ruta: `/v1/guides/${PUB}/file` },
  { metodo: "GET", ruta: "/v1/teacher/subjects" },
  { metodo: "GET", ruta: "/v1/teachers" },
  { metodo: "POST", ruta: "/v1/teachers", body: { fullName: "Nuevo Docente", username: "nuevo.docente", temporaryPassword: "clave-temporal-123" } },
  { metodo: "GET", ruta: `/v1/teachers/${LAURA}` },
  { metodo: "PATCH", ruta: `/v1/teachers/${LAURA}`, body: { fullName: "Laura Martínez" } },
  { metodo: "DELETE", ruta: `/v1/teachers/${LAURA}` },
  { metodo: "POST", ruta: `/v1/teachers/${LAURA}/password`, body: { password: "clave-nueva-123" } },
];

/** Las cuatro rutas del estudiante (API-07), que deben caer juntas con la sesión. */
const RUTAS_ESTUDIANTE = [
  "/v1/student/group",
  `/v1/student/subjects/${MATH}/guides`,
  `/v1/student/guides/${PUB}`,
  `/v1/guides/${PUB}/file`,
];

/** Sesión del estudiante firmada a mano, para simular un código regenerado. */
async function sesionVieja(codeVersion: number): Promise<Record<string, string>> {
  return { Cookie: `${STUDENT_COOKIE}=${await signStudentSession({ groupId: G1, codeVersion })}` };
}

describe("API-09 — permisos", () => {
  describe("Un profesor no toca materias ajenas", () => {
    it("las siete rutas de guía de otra materia responden 403 a otro profesor", async () => {
      await withSeed({}, async (client) => {
        for (const ruta of RUTAS_DE_GUIA) {
          const res = await llamar(ruta, client.staffSession(CARLOS).headers);
          expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(403);
          expect(await res.json()).toEqual({ error: "Sin permiso" });
        }
      });
    });

    it("al administrador le cierran las rutas de gestión de guía: las lleva el profesor (403)", async () => {
      await withSeed({}, async (client) => {
        // La descarga /file sí le corresponde al admin (ve cualquier guía, API-07).
        for (const ruta of RUTAS_DE_GUIA.filter((row) => !row.ruta.endsWith("/file"))) {
          const res = await llamar(ruta, client.staffSession(ADMIN).headers);
          expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(403);
          expect(await res.json()).toEqual({ error: "Sin permiso" });
        }
      });
    });

    it("el dueño de la materia sí entra en sus rutas de lectura (200)", async () => {
      await withSeed({}, async (client) => {
        const headers = client.staffSession(LAURA).headers;
        for (const ruta of RUTAS_DE_GUIA.filter((row) => row.metodo === "GET" && !row.ruta.endsWith("/file"))) {
          const res = await llamar(ruta, headers);
          expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(200);
        }
        // La descarga también es suya: su guía publicada con URL firmada.
        const file = await app.request(`/v1/guides/${PUB}/file`, { headers });
        expect(file.status).toBe(200);
      });
    });
  });

  describe("Un estudiante no ve otro grupo ni los borradores", () => {
    it("Mis materias solo enseña publicadas de su grupo", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request("/v1/student/group", { headers: (await client.studentSession(G1)).headers });
        expect(res.status).toBe(200);
        const body = await res.json();

        // Ni el borrador de Matemáticas ni la guía de Ciencias (G2) cuentan ni se listan.
        expect(body.subjects.map((row: { id: string }) => row.id)).toEqual([LANG, MATH]);
        expect(body.subjects.map((row: { publishedGuides: number }) => row.publishedGuides)).toEqual([1, 1]);
        expect(body.recentGuides.map((row: { id: string }) => row.id)).toEqual([PUB, PUB_LANG]);
        expect(body.totalPublishedGuides).toBe(2);
      });
    });

    it("la lista de una materia deja los borradores fuera", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/student/subjects/${MATH}/guides`, {
          headers: (await client.studentSession(G1)).headers,
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items.map((row: { id: string }) => row.id)).toEqual([PUB]);
        expect(body.total).toBe(1);
      });
    });

    it("lo de otro grupo o en borrador no existe para él (404)", async () => {
      const casos: { ruta: string; error: string }[] = [
        { ruta: `/v1/student/subjects/${SCI}/guides`, error: "Materia no encontrada" },
        { ruta: `/v1/student/guides/${DRAFT}`, error: "Guía no encontrada" },
        { ruta: `/v1/student/guides/${PUB_SCI}`, error: "Guía no encontrada" },
        { ruta: `/v1/guides/${DRAFT}/file`, error: "Guía no encontrada" },
        { ruta: `/v1/guides/${PUB_SCI}/file`, error: "Guía no encontrada" },
      ];
      await withSeed({}, async (client) => {
        const headers = (await client.studentSession(G1)).headers;
        for (const caso of casos) {
          const res = await app.request(caso.ruta, { headers });
          expect(res.status, caso.ruta).toBe(404);
          expect(await res.json()).toEqual({ error: caso.error });
        }
      });
    });
  });

  describe("Un código regenerado o un grupo eliminado invalidan la sesión", () => {
    it("si el código se regeneró, ninguna ruta del estudiante acepta la sesión vieja (401)", async () => {
      await withSeed({}, async () => {
        const headers = await sesionVieja(99); // el grupo sigue en la versión 1
        for (const ruta of RUTAS_ESTUDIANTE) {
          const res = await app.request(ruta, { headers });
          expect(res.status, ruta).toBe(401);
          expect(await res.json()).toEqual({ error: "El código ya no es válido" });
        }
      });
    });

    it("si el grupo se elimina, la sesión cae en todas sus rutas (401)", async () => {
      await withSeed({}, async (client) => {
        const headers = (await client.studentSession(G1)).headers;
        // El admin borra el grupo después de que el estudiante entrara.
        const index = client.groups.findIndex((row) => row.id === G1);
        client.groups.splice(index, 1);

        for (const ruta of RUTAS_ESTUDIANTE) {
          const res = await app.request(ruta, { headers });
          expect(res.status, ruta).toBe(401);
          expect(await res.json()).toEqual({ error: "El código ya no es válido" });
        }
      });
    });
  });

  describe("Un profesor desactivado no entra", () => {
    it("ninguna ruta del staff lo deja pasar (403)", async () => {
      await withSeed({}, async (client) => {
        const headers = client.staffSession(DE_BAJA).headers;
        for (const ruta of RUTAS_STAFF) {
          const res = await llamar(ruta, headers);
          expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(403);
          expect(await res.json()).toEqual({ error: "Sin permiso" });
        }
      });
    });

    it("mientras tanto, un profesor activo sí entra (200)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request("/v1/me", { headers: client.staffSession(LAURA).headers });
        expect(res.status).toBe(200);
      });
    });
  });

  describe("Sin sesión no se abre nada", () => {
    it("ninguna ruta del staff responde sin Bearer (401)", async () => {
      await withSeed({}, async () => {
        for (const ruta of RUTAS_STAFF) {
          const res = await llamar(ruta, {});
          expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(401);
          expect(await res.json()).toEqual({ error: "Falta sesión" });
        }
      });
    });

    it("la cookie del estudiante no abre las rutas del staff (401), salvo la descarga, que es suya", async () => {
      await withSeed({}, async (client) => {
        const cookie = (await client.studentSession(G1)).headers;
        const staff = RUTAS_STAFF.filter((ruta) => !ruta.ruta.endsWith("/file"));
        for (const ruta of staff) {
          const res = await llamar(ruta, cookie);
          expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(401);
          expect(await res.json()).toEqual({ error: "Falta sesión" });
        }

        // /v1/guides/:id/file está hecha a propósito para estudiante (API-07).
        const descarga = await app.request(`/v1/guides/${PUB}/file`, { headers: cookie });
        expect(descarga.status).toBe(200);
      });
    });
  });
});
