import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireStudent, type AppVars } from "../middleware/auth.js";
import { createTestApp, IDS, studentCookie } from "./helper.js";

// Ruta sonda: no existe una de estudiante todavía (API-07), así que el helper se comprueba
// montando requireStudent, que es lo que esa ruta usará.
const probe = new Hono<{ Variables: AppVars }>()
  .use(requireStudent)
  .get("/grupo", (c) => c.json(c.get("student")));

describe("sesión de estudiante (helper de tests)", () => {
  it("acepta una cookie firmada con el código vigente", async () => {
    const { app } = createTestApp();
    app.route("/sonda", probe);
    const res = await app.request("/sonda/grupo", { headers: { Cookie: await studentCookie() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ groupId: IDS.group, codeVersion: 1 });
  });

  it("rechaza si no hay cookie", async () => {
    const { app } = createTestApp();
    app.route("/sonda", probe);
    const res = await app.request("/sonda/grupo");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Ingresa tu código de acceso" });
  });

  it("rechaza una cookie basura", async () => {
    const { app } = createTestApp();
    app.route("/sonda", probe);
    const res = await app.request("/sonda/grupo", { headers: { Cookie: "cg_student=basura" } });
    expect(res.status).toBe(401);
  });

  it("rechaza una sesión anterior a regenerar el código", async () => {
    const { app, data } = createTestApp();
    app.route("/sonda", probe);
    // El admin regenera: sube la versión en la base, la cookie vieja deja de valer.
    data.groups[0]!.code_version = 2;
    const res = await app.request("/sonda/grupo", { headers: { Cookie: await studentCookie({ codeVersion: 1 }) } });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "El código ya no es válido" });
  });
});
