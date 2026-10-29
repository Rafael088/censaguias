import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase } from "../lib/testing.js";

const ADMIN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_ID = "bbbbbbbb-0000-4000-8000-000000000002"; // activo, dos materias
const OTHER_TEACHER = "bbbbbbbb-0000-4000-8000-000000000003"; // activo, una materia
const DEACTIVATED = "bbbbbbbb-0000-4000-8000-000000000004"; // apagado, pero aún guarda una materia
const NEW_TEACHER = "bbbbbbbb-0000-4000-8000-000000000005"; // activo, sin materias todavía
const G1 = "cccccccc-0000-4000-8000-000000000010"; // CLEI IV · A · Mañana
const G2 = "cccccccc-0000-4000-8000-000000000020"; // CLEI V · B · Noche
const G3 = "cccccccc-0000-4000-8000-000000000030"; // CLEI VI · A · Sabatina

let db: FakeSupabase;

beforeAll(() => {
  db = fakeSupabase({
    profiles: [
      { id: ADMIN_ID, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
      { id: TEACHER_ID, username: "luis.docente", full_name: "Luis Docente", role: "teacher", active: true },
      { id: OTHER_TEACHER, username: "carlos.docente", full_name: "Carlos Docente", role: "teacher", active: true },
      { id: DEACTIVATED, username: "ana.docente", full_name: "Ana Docente", role: "teacher", active: false },
      { id: NEW_TEACHER, username: "nuevo.docente", full_name: "Nuevo Docente", role: "teacher", active: true },
    ],
    groups: [
      { id: G1, clei: 4, identifier: "A", shift: "morning", school_year: 2026, access_code: "CENSA-4AM-K7Q", created_at: "2026-01-03T10:00:00.000Z" },
      { id: G2, clei: 5, identifier: "B", shift: "night", school_year: 2026, access_code: "CENSA-5BN-2T7", created_at: "2026-01-02T10:00:00.000Z" },
      { id: G3, clei: 6, identifier: "A", shift: "saturday", school_year: 2026, access_code: "CENSA-6AS-9PK", created_at: "2026-01-01T10:00:00.000Z" },
    ],
    subjects: [
      { id: "dddddddd-0000-4000-8000-000000000101", group_id: G1, name: "Matemáticas", teacher_id: TEACHER_ID },
      { id: "dddddddd-0000-4000-8000-000000000102", group_id: G1, name: "Lengua Castellana", teacher_id: OTHER_TEACHER },
      { id: "dddddddd-0000-4000-8000-000000000103", group_id: G2, name: "Ciencias Naturales", teacher_id: TEACHER_ID },
      { id: "dddddddd-0000-4000-8000-000000000104", group_id: G3, name: "Historia", teacher_id: DEACTIVATED },
    ],
    guides: [{ status: "published" }, { status: "published" }, { status: "draft" }],
  });
});

afterAll(() => db.restore());

const admin = () => db.staffSession(ADMIN_ID).headers;
const teacher = () => db.staffSession(TEACHER_ID).headers;
const summary = (headers: Record<string, string> = {}) => app.request("/v1/admin/summary", { headers });

describe("GET /v1/admin/summary", () => {
  it("pide sesión", async () => {
    const res = await summary();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Falta sesión" });
  });

  it("es solo del administrador", async () => {
    const res = await summary(teacher());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Sin permiso" });
  });

  it("devuelve los números de admin-01, la distribución por jornada y los grupos recientes", async () => {
    const res = await summary(admin());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toMatchObject({
      groups: 3,
      activeTeachers: 3, // Luis, Carlos y el recién registrado; la profesora apagada no cuenta.
      assignedTeachers: 2, // Luis y Carlos: el apagado queda fuera y el nuevo no tiene materias.
      subjects: 4,
      publishedGuides: 2,
    });

    expect(body.shifts).toEqual([
      { shift: "morning", label: "Mañana", groups: 1, percent: 33.3 },
      { shift: "night", label: "Noche", groups: 1, percent: 33.3 },
      { shift: "saturday", label: "Sabatina", groups: 1, percent: 33.3 },
    ]);

    expect(body.recentGroups.map((group: { id: string }) => group.id)).toEqual([G1, G2, G3]);
    expect(body.recentGroups[0]).toMatchObject({ label: "CLEI IV · A", accessCode: "CENSA-4AM-K7Q", subjects: 2 });
    expect(body.recentGroups[2]).toMatchObject({ label: "CLEI VI · A", subjects: 1 });
  });

  it("sin grupos no hay porcentajes que repartir", async () => {
    const guardados = [...db.groups];
    db.groups.length = 0; // el simulador comparte el array con la tabla
    try {
      const body = await (await summary(admin())).json();
      expect(body.groups).toBe(0);
      expect(body.shifts.every((shift: { groups: number; percent: number }) => shift.groups === 0 && shift.percent === 0)).toBe(true);
      expect(body.recentGroups).toEqual([]);
    } finally {
      db.groups.push(...guardados);
    }
  });
});
