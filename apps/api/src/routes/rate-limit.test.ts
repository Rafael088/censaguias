import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { TOO_MANY_ATTEMPTS, resetRateLimits } from "../lib/rate-limit.js";
import { fakeSupabase } from "../lib/testing.js";

// Dominio por defecto de env(): staffEmail("docente") → docente@staff.censaguias.app
const CODE = "CENSA-4AM-K7Q";
const group = { id: "g1", clei: 4, identifier: "A", shift: "morning", school_year: 2025, code_version: 1, access_code: CODE };

const xff = (ip: string) => ({ "content-type": "application/json", "x-forwarded-for": ip });
const postAccess = (code: string, ip: string) =>
  app.request("/v1/access", { method: "POST", body: JSON.stringify({ code }), headers: xff(ip) });
const postLogin = (username: string, password: string) =>
  app.request("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    headers: { "content-type": "application/json" },
  });

describe("POST /v1/access — límite por IP", () => {
  beforeEach(resetRateLimits);

  it("deja los primeros intentos y responde 429 al agotar la ventana", async () => {
    const db = fakeSupabase({ groups: [group] });
    try {
      for (let i = 0; i < 10; i += 1) {
        expect((await postAccess(CODE, "203.0.113.9")).status).toBe(200);
      }
      const last = await postAccess(CODE, "203.0.113.9");
      expect(last.status).toBe(429);
      expect(await last.json()).toEqual({ error: TOO_MANY_ATTEMPTS });
    } finally {
      db.restore();
    }
  });

  it("cuenta cada IP por su lado", async () => {
    const db = fakeSupabase({ groups: [group] });
    try {
      for (let i = 0; i < 10; i += 1) {
        await postAccess(CODE, "198.51.100.4");
      }
      const otra = await postAccess(CODE, "198.51.100.5");
      expect(otra.status).toBe(200);
    } finally {
      db.restore();
    }
  });

  it("toma el último X-Forwarded-For (el que añade el proxy)", async () => {
    const db = fakeSupabase({ groups: [group] });
    try {
      // La primera IP es la del cliente: falsearla no libera intentos de la del proxy.
      for (let i = 0; i < 10; i += 1) {
        await app.request("/v1/access", {
          method: "POST",
          body: JSON.stringify({ code: CODE }),
          headers: xff(`10.0.0.${i}, 203.0.113.30`),
        });
      }
      const last = await app.request("/v1/access", {
        method: "POST",
        body: JSON.stringify({ code: CODE }),
        headers: xff("192.0.2.1, 203.0.113.30"),
      });
      expect(last.status).toBe(429);
    } finally {
      db.restore();
    }
  });

  it("sigue rechazando el código malo con 404 dentro del límite", async () => {
    const db = fakeSupabase({ groups: [group] });
    try {
      const res = await postAccess("CENSA-4AM-ZZZ", "203.0.113.50");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Código no válido" });
    } finally {
      db.restore();
    }
  });
});

describe("POST /v1/auth/login — límite por usuario", () => {
  beforeEach(resetRateLimits);

  const logins = {
    "docente@staff.censaguias.app": "clave-secreta",
    "otra@staff.censaguias.app": "otra-clave",
  };

  it("bloquea con 429 al décimo intento fallido del mismo usuario", async () => {
    const db = fakeSupabase({ logins });
    try {
      for (let i = 0; i < 10; i += 1) {
        expect((await postLogin("docente", "equivocada")).status).toBe(401);
      }
      const last = await postLogin("docente", "equivocada");
      expect(last.status).toBe(429);
      expect(await last.json()).toEqual({ error: TOO_MANY_ATTEMPTS });
    } finally {
      db.restore();
    }
  });

  it("cuenta por usuario, no por IP: otro usuario sigue entrando", async () => {
    const db = fakeSupabase({ logins });
    try {
      for (let i = 0; i < 10; i += 1) {
        await postLogin("docente", "equivocada");
      }
      const ok = await postLogin("otra", "otra-clave");
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ session: { access_token: expect.any(String) } });
    } finally {
      db.restore();
    }
  });

  it("un login correcto del usuario bloqueado no le devuelve los intentos", async () => {
    const db = fakeSupabase({ logins });
    try {
      for (let i = 0; i < 9; i += 1) {
        await postLogin("docente", "equivocada");
      }
      expect((await postLogin("docente", "clave-secreta")).status).toBe(200);
      // El intento correcto también cuenta: la ventana ya está llena y el siguiente cierra.
      expect((await postLogin("docente", "equivocada")).status).toBe(429);
    } finally {
      db.restore();
    }
  });
});
