import { describe, expect, it } from "vitest";
import { bearer, createTestApp, IDS, tokens } from "../test/helper.js";

describe("GET /v1/me", () => {
  it("pide sesión: sin Bearer responde 401", async () => {
    const { app } = createTestApp();
    const res = await app.request("/v1/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Falta sesión" });
  });

  it("rechaza un token que Supabase no conoce", async () => {
    const { app } = createTestApp();
    const res = await app.request("/v1/me", { headers: bearer(tokens.unknown) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sesión inválida" });
  });

  it("devuelve el perfil del admin sin materias", async () => {
    const { app } = createTestApp();
    const res = await app.request("/v1/me", { headers: bearer(tokens.admin) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: IDS.admin,
      username: "maria.lopez",
      fullName: "María López",
      role: "admin",
      subjects: [],
    });
  });

  it("al profesor le devuelve solo sus materias, con su grupo", async () => {
    const { app } = createTestApp();
    const res = await app.request("/v1/me", { headers: bearer(tokens.teacher) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: IDS.teacher,
      username: "laura.martinez",
      fullName: "Laura Martínez",
      role: "teacher",
      subjects: [{ id: IDS.math, name: "Matemáticas", group: { id: IDS.group, label: "CLEI IV · A" } }],
    });
  });

  it("cada profesor ve las suyas, no las del otro", async () => {
    const { app } = createTestApp();
    const res = await app.request("/v1/me", { headers: bearer(tokens.otherTeacher) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subjects).toHaveLength(1);
    expect(body.subjects[0].name).toBe("Ciencias Naturales");
  });

  it("un profesor desactivado no entra (403)", async () => {
    const { app } = createTestApp();
    const res = await app.request("/v1/me", { headers: bearer(tokens.inactiveTeacher) });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Sin permiso" });
  });

  it("una cookie de estudiante no sirve en rutas de staff", async () => {
    const { app } = createTestApp();
    const res = await app.request("/v1/me", { headers: { Cookie: "cg_student=lo-que-sea" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Falta sesión" });
  });
});