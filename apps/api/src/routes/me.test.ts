import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase } from "../lib/testing.js";

const ADMIN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_ID = "bbbbbbbb-0000-4000-8000-000000000002";
const GROUP_ID = "cccccccc-0000-4000-8000-000000000003";

let db: FakeSupabase;

beforeAll(() => {
  db = fakeSupabase({
    profiles: [
      { id: ADMIN_ID, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
      { id: TEACHER_ID, username: "luis.docente", full_name: "Luis Docente", role: "teacher", active: true },
    ],
    groups: [{ id: GROUP_ID, code_version: 1 }],
    subjects: [
      { id: "dddddddd-0000-4000-8000-000000000004", name: "Álgebra", group_id: GROUP_ID, teacher_id: TEACHER_ID },
      { id: "eeeeeeee-0000-4000-8000-000000000005", name: "Física", group_id: GROUP_ID, teacher_id: TEACHER_ID },
    ],
  });
});

afterAll(() => db.restore());

const me = (headers: Record<string, string> = {}) => app.request("/v1/me", { headers });

describe("GET /v1/me", () => {
  it("devuelve el perfil del admin, sin materias", async () => {
    const res = await me(db.staffSession(ADMIN_ID).headers);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: ADMIN_ID,
      username: "ana.admin",
      fullName: "Ana Admin",
      role: "admin",
      subjects: [],
    });
  });

  it("devuelve el perfil del profesor con sus materias", async () => {
    const res = await me(db.staffSession(TEACHER_ID).headers);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: TEACHER_ID, username: "luis.docente", fullName: "Luis Docente", role: "teacher" });
    expect(body.subjects).toHaveLength(2);
    const names: string[] = body.subjects.map((s: { name: string }) => s.name);
    expect(names.sort((a: string, b: string) => a.localeCompare(b, "es"))).toEqual(["Álgebra", "Física"]);
    expect(body.subjects[0]).toMatchObject({ groupId: GROUP_ID });
  });

  it("pide sesión", async () => {
    const res = await me();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Falta sesión" });
  });

  it("rechaza un token que Supabase no conoce", async () => {
    const res = await me({ Authorization: "Bearer token-inventado" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sesión inválida" });
  });

  it("rechaza a un profesor desactivado aunque su token sirva", async () => {
    const profile = db.profiles.find((p) => p.id === TEACHER_ID);
    if (profile) profile.active = false;
    try {
      const res = await me(db.staffSession(TEACHER_ID).headers);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Sin permiso" });
    } finally {
      if (profile) profile.active = true;
    }
  });

  it("no acepta la cookie de estudiante en una ruta de staff", async () => {
    const res = await me((await db.studentSession(GROUP_ID)).headers);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Falta sesión" });
  });
});
