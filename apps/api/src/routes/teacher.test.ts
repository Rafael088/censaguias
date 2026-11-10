import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase, type Seed } from "../lib/testing.js";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const LAURA = "bbbbbbbb-0000-4000-8000-000000000002";
const CARLOS = "bbbbbbbb-0000-4000-8000-000000000003";
const NUEVO = "bbbbbbbb-0000-4000-8000-000000000004";
const G1 = "cccccccc-0000-4000-8000-000000000010"; // CLEI IV · A, Mañana
const G2 = "cccccccc-0000-4000-8000-000000000011"; // CLEI V · B, Noche
const MATH_G1 = "dddddddd-0000-4000-8000-000000000101";
const PHYS_G2 = "dddddddd-0000-4000-8000-000000000102";
const SCI_G1 = "dddddddd-0000-4000-8000-000000000103";

const PROFILES: Seed["profiles"] = [
  { id: ADMIN, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
  { id: LAURA, username: "laura.martinez", full_name: "Laura Martínez", role: "teacher", active: true },
  { id: CARLOS, username: "carlos.rojas", full_name: "Carlos Rojas", role: "teacher", active: true },
  { id: NUEVO, username: "profesor.nuevo", full_name: "Profesor Nuevo", role: "teacher", active: true },
];

const GROUPS: Seed["groups"] = [
  { id: G1, clei: 4, identifier: "A", shift: "morning", school_year: 2026, access_code: "CENSA-4AM-K7Q", code_version: 1 },
  { id: G2, clei: 5, identifier: "B", shift: "night", school_year: 2026, access_code: "CENSA-5BN-8TZ", code_version: 1 },
];

const SUBJECTS: Seed["subjects"] = [
  { id: MATH_G1, group_id: G1, name: "Matemáticas", teacher_id: LAURA },
  { id: PHYS_G2, group_id: G2, name: "Física", teacher_id: LAURA },
  { id: SCI_G1, group_id: G1, name: "Ciencias Naturales", teacher_id: CARLOS },
];

/** Guía con el mismo día en created_at y updated_at (dos dígitos: el orden ISO es el cronológico). */
function guide(id: string, subjectId: string, day: string, status: "draft" | "published", topic = "Álgebra") {
  return {
    id,
    subject_id: subjectId,
    topic,
    title: `Guía del ${day}`,
    description: "Enunciado de prueba",
    status,
    published_at: status === "published" ? `2026-10-${day}T10:00:00.000Z` : null,
    storage_path: `${G1}/${subjectId}/${id}.pdf`,
    file_name: "guia.pdf",
    size_bytes: 1024,
    created_at: `2026-10-${day}T08:00:00.000Z`,
    updated_at: `2026-10-${day}T10:00:00.000Z`,
  };
}

const guideId = (day: string) => `eeeeeeee-0000-4000-8000-0000000000${day}`;

let db: FakeSupabase;

/** Monta la app con este seed, corre el caso y devuelve el cliente al simulador real. */
async function withSeed(seed: Seed, run: (client: FakeSupabase) => Promise<void>): Promise<void> {
  db = fakeSupabase(seed);
  try {
    await run(db);
  } finally {
    db.restore();
  }
}

afterAll(() => db?.restore());

describe("GET /v1/teacher/subjects — API-06b: materias del profesor", () => {
  it("pide sesión: sin Bearer responde 401", async () => {
    const res = await app.request("/v1/teacher/subjects");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Falta sesión" });
  });

  it("rechaza al admin: es el espacio docente (403)", async () => {
    await withSeed({ profiles: PROFILES, groups: GROUPS, subjects: [], guides: [] }, async (client) => {
      const res = await app.request("/v1/teacher/subjects", { headers: client.staffSession(ADMIN).headers });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Sin permiso" });
    });
  });

  it("un profesor sin materias devuelve las dos listas vacías", async () => {
    await withSeed({ profiles: PROFILES, groups: GROUPS, subjects: [], guides: [] }, async (client) => {
      const res = await app.request("/v1/teacher/subjects", { headers: client.staffSession(NUEVO).headers });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ subjects: [], recentGuides: [] });
    });
  });

  it("devuelve sus materias con el grupo y el conteo de publicadas y borradores", async () => {
    const guides = [
      guide(guideId("10"), MATH_G1, "10", "published"),
      guide(guideId("13"), MATH_G1, "13", "draft"),
      guide(guideId("14"), MATH_G1, "14", "published"),
      guide(guideId("12"), PHYS_G2, "12", "published", "Mecánica"),
      guide(guideId("15"), SCI_G1, "15", "published", "Células"),
    ];
    await withSeed({ profiles: PROFILES, groups: GROUPS, subjects: SUBJECTS, guides }, async (client) => {
      const res = await app.request("/v1/teacher/subjects", { headers: client.staffSession(LAURA).headers });
      expect(res.status).toBe(200);
      const body = await res.json();

      // Orden por nombre (Física < Matemáticas); solo las materias de Laura.
      expect(body.subjects).toEqual([
        {
          id: PHYS_G2,
          name: "Física",
          group: { id: G2, label: "CLEI V · B", shift: "night", shiftLabel: "Noche", accessCode: "CENSA-5BN-8TZ" },
          publishedGuides: 1,
          draftGuides: 0,
        },
        {
          id: MATH_G1,
          name: "Matemáticas",
          group: { id: G1, label: "CLEI IV · A", shift: "morning", shiftLabel: "Mañana", accessCode: "CENSA-4AM-K7Q" },
          publishedGuides: 2,
          draftGuides: 1,
        },
      ]);

      // Las guías de Carlos no aparecen: cada profesor ve lo suyo.
      expect(body.recentGuides).toEqual([
        {
          id: guideId("14"),
          title: "Guía del 14",
          topic: "Álgebra",
          status: "published",
          updatedAt: "2026-10-14T10:00:00.000Z",
          subject: { id: MATH_G1, name: "Matemáticas" },
          group: { id: G1, label: "CLEI IV · A", shift: "morning", shiftLabel: "Mañana", accessCode: "CENSA-4AM-K7Q" },
        },
        {
          id: guideId("13"),
          title: "Guía del 13",
          topic: "Álgebra",
          status: "draft",
          updatedAt: "2026-10-13T10:00:00.000Z",
          subject: { id: MATH_G1, name: "Matemáticas" },
          group: { id: G1, label: "CLEI IV · A", shift: "morning", shiftLabel: "Mañana", accessCode: "CENSA-4AM-K7Q" },
        },
        {
          id: guideId("12"),
          title: "Guía del 12",
          topic: "Mecánica",
          status: "published",
          updatedAt: "2026-10-12T10:00:00.000Z",
          subject: { id: PHYS_G2, name: "Física" },
          group: { id: G2, label: "CLEI V · B", shift: "night", shiftLabel: "Noche", accessCode: "CENSA-5BN-8TZ" },
        },
        {
          id: guideId("10"),
          title: "Guía del 10",
          topic: "Álgebra",
          status: "published",
          updatedAt: "2026-10-10T10:00:00.000Z",
          subject: { id: MATH_G1, name: "Matemáticas" },
          group: { id: G1, label: "CLEI IV · A", shift: "morning", shiftLabel: "Mañana", accessCode: "CENSA-4AM-K7Q" },
        },
      ]);
    });
  });

  it("las guías recientes salen por fecha y como máximo 10", async () => {
    // 12 guías de Laura (días 01 a 12) y una de Carlos más nueva, que no debe colarse.
    const guides = Array.from({ length: 12 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return guide(guideId(day), MATH_G1, day, index % 2 === 0 ? "published" : "draft");
    });
    guides.push(guide(guideId("16"), SCI_G1, "16", "published", "Células"));

    await withSeed({ profiles: PROFILES, groups: GROUPS, subjects: SUBJECTS, guides }, async (client) => {
      const res = await app.request("/v1/teacher/subjects", { headers: client.staffSession(LAURA).headers });
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body.recentGuides).toHaveLength(10);
      expect(body.recentGuides[0].updatedAt).toBe("2026-10-12T10:00:00.000Z");
      expect(body.recentGuides[9].updatedAt).toBe("2026-10-03T10:00:00.000Z");
      expect(body.recentGuides.some((row: { subject: { id: string } }) => row.subject.id === SCI_G1)).toBe(false);
      // El conteo de la tarjeta sigue siendo de todas, no solo de las 10 que se listan.
      expect(body.subjects.find((row: { id: string }) => row.id === MATH_G1)).toMatchObject({
        publishedGuides: 6,
        draftGuides: 6,
      });
    });
  });

  it("cada profesor solo ve sus materias", async () => {
    await withSeed(
      { profiles: PROFILES, groups: GROUPS, subjects: SUBJECTS, guides: [guide(guideId("15"), SCI_G1, "15", "published")] },
      async (client) => {
        const res = await app.request("/v1/teacher/subjects", { headers: client.staffSession(CARLOS).headers });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.subjects).toHaveLength(1);
        expect(body.subjects[0].id).toBe(SCI_G1);
        expect(body.recentGuides).toHaveLength(1);
        expect(body.recentGuides[0].id).toBe(guideId("15"));
      },
    );
  });
});
