import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase, type Seed } from "../lib/testing.js";

const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const LAURA = "bbbbbbbb-0000-4000-8000-000000000002";
const CARLOS = "bbbbbbbb-0000-4000-8000-000000000003";
const EVA = "bbbbbbbb-0000-4000-8000-000000000004";
const G1 = "cccccccc-0000-4000-8000-000000000010"; // CLEI IV · A, Mañana
const G2 = "cccccccc-0000-4000-8000-000000000011"; // CLEI V · B, Noche
const MATH = "dddddddd-0000-4000-8000-000000000101"; // G1, Laura
const LANG = "dddddddd-0000-4000-8000-000000000102"; // G1, Carlos
const PHYS = "dddddddd-0000-4000-8000-000000000104"; // G2, Laura
const G_PUB = "eeeeeeee-0000-4000-8000-000000000001";

const DOMAIN = "staff.censaguias.app";

const PROFILES: Seed["profiles"] = [
  { id: ADMIN, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true, email: `ana.admin@${DOMAIN}` },
  { id: LAURA, username: "laura.martinez", full_name: "Laura Martínez", role: "teacher", active: true, email: `laura.martinez@${DOMAIN}` },
  { id: CARLOS, username: "carlos.ramirez", full_name: "Carlos Ramírez", role: "teacher", active: true, email: `carlos.ramirez@${DOMAIN}` },
  { id: EVA, username: "eva.lopez", full_name: "Eva López", role: "teacher", active: false, email: `eva.lopez@${DOMAIN}` },
];

/** Cada perfil de staff tiene su usuario en Auth con el correo sintético (ADR 0006). */
const AUTH_USERS: Seed["authUsers"] = PROFILES.map((profile) => ({
  id: profile.id as string,
  email: profile.email as string,
  password: "clave-inicial-123",
}));

const GROUPS: Seed["groups"] = [
  { id: G1, clei: 4, identifier: "A", shift: "morning", school_year: 2026, access_code: "CENSA-4AM-K7Q", code_version: 1 },
  { id: G2, clei: 5, identifier: "B", shift: "night", school_year: 2026, access_code: "CENSA-5BN-8TZ", code_version: 1 },
];

const SUBJECTS: Seed["subjects"] = [
  { id: MATH, group_id: G1, name: "Matemáticas", description: "Álgebra y operaciones", teacher_id: LAURA },
  { id: LANG, group_id: G1, name: "Lengua Castellana", description: "Lectura y escritura", teacher_id: CARLOS },
  { id: PHYS, group_id: G2, name: "Física", description: "Mecánica", teacher_id: LAURA },
];

const GUIDES: Seed["guides"] = [
  {
    id: G_PUB,
    subject_id: MATH,
    topic: "Álgebra",
    title: "Ecuaciones de primer grado",
    description: "Aprende paso a paso con ejemplos resueltos.",
    status: "published",
    published_at: "2026-10-14T08:00:00.000Z",
    storage_path: `${G1}/${MATH}/${G_PUB}.pdf`,
    file_name: "guia.pdf",
    size_bytes: 1_800_000,
    page_count: 4,
    created_at: "2026-10-14T08:00:00.000Z",
    updated_at: "2026-10-14T08:00:00.000Z",
  },
];

/** Petición con cuerpo JSON, igual que en groups.test.ts. */
const json = (method: string, body: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

async function withSeed(extra: Partial<Seed>, run: (client: FakeSupabase) => Promise<void>): Promise<void> {
  const client = fakeSupabase({
    profiles: structuredClone(PROFILES),
    groups: structuredClone(GROUPS),
    subjects: structuredClone(SUBJECTS),
    guides: structuredClone(GUIDES),
    authUsers: structuredClone(AUTH_USERS),
    ...extra,
  });
  try {
    await run(client);
  } finally {
    client.restore();
  }
}

const noSeed = () => withSeed({}, async () => undefined);

afterAll(() => undefined);

describe("API-08 — profesores (admin)", () => {
  describe("GET /v1/teachers", () => {
    it("pide sesión de administrador: sin token responde 401", async () => {
      await noSeed();
      const res = await app.request("/v1/teachers");
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Falta sesión" });
    });

    it("un profesor no entra (403)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request("/v1/teachers", { headers: client.staffSession(LAURA).headers });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "Sin permiso" });
      });
    });

    it("lista los docentes con materias y grupos, y cuenta los activos", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request("/v1/teachers", { headers: client.staffSession(ADMIN).headers });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.total).toBe(3); // los profesores, no el admin
        expect(body.activeCount).toBe(2); // Eva está inactiva y no cuenta en el rótulo
        expect(body.items.map((row: { username: string }) => row.username)).toEqual([
          "carlos.ramirez",
          "eva.lopez",
          "laura.martinez",
        ]);

        const laura = body.items.find((row: { id: string }) => row.id === LAURA);
        expect(laura).toEqual({
          id: LAURA,
          username: "laura.martinez",
          fullName: "Laura Martínez",
          active: true,
          subjects: ["Física", "Matemáticas"],
          groups: ["CLEI IV · A / Mañana", "CLEI V · B / Noche"],
        });
        expect(body.items.find((row: { id: string }) => row.id === EVA)).toMatchObject({
          active: false,
          subjects: [],
          groups: [],
        });
      });
    });

    it("busca por nombre y por usuario", async () => {
      await withSeed({}, async (client) => {
        const headers = client.staffSession(ADMIN).headers;

        const byName = await app.request("/v1/teachers?q=Eva", { headers });
        expect(((await byName.json()).items as { id: string }[]).map((row) => row.id)).toEqual([EVA]);

        const byUsername = await app.request("/v1/teachers?q=laura.mart", { headers });
        expect(((await byUsername.json()).items as { id: string }[]).map((row) => row.id)).toEqual([LAURA]);
      });
    });

    it("pagina la lista", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request("/v1/teachers?pageSize=2&page=2", {
          headers: client.staffSession(ADMIN).headers,
        });
        const body = await res.json();
        expect(body.total).toBe(3);
        expect(body.page).toBe(2);
        expect(body.items.map((row: { username: string }) => row.username)).toEqual(["laura.martinez"]);
      });
    });
  });

  describe("POST /v1/teachers", () => {
    it("un profesor no registra a nadie (403)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          "/v1/teachers",
          json("POST", { fullName: "Nuevo Docente", username: "nuevo.docente", temporaryPassword: "clave-temporal-1" }, client.staffSession(CARLOS).headers),
        );
        expect(res.status).toBe(403);
      });
    });

    it("datos inválidos: 400", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          "/v1/teachers",
          json("POST", { fullName: "Nuevo Docente", username: "x", temporaryPassword: "corta" }, client.staffSession(ADMIN).headers),
        );
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Datos del profesor no válidos" });
      });
    });

    it("crea el usuario de Auth con el correo sintético y después el perfil", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          "/v1/teachers",
          json("POST", { fullName: "Nuevo Docente", username: "nuevo.docente", temporaryPassword: "clave-temporal-1" }, client.staffSession(ADMIN).headers),
        );
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body).toEqual({
          id: expect.any(String),
          username: "nuevo.docente",
          fullName: "Nuevo Docente",
          active: true,
        });

        const user = client.authUsers.find((row) => row.email === `nuevo.docente@${DOMAIN}`);
        expect(user).toBeDefined();
        expect(user?.password).toBe("clave-temporal-1");

        const profile = client.profiles.find((row) => row.id === body.id);
        expect(profile).toMatchObject({ username: "nuevo.docente", role: "teacher", active: true });
        // El usuario y el perfil son la misma persona: la FK los ata por id.
        expect(profile?.id).toBe(user?.id);
      });
    });

    it("si el usuario ya existe, responde 409 y no crea nada", async () => {
      await withSeed({}, async (client) => {
        const before = client.authUsers.length;
        const res = await app.request(
          "/v1/teachers",
          json("POST", { fullName: "Laura Otra", username: "laura.martinez", temporaryPassword: "clave-temporal-1" }, client.staffSession(ADMIN).headers),
        );
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: "Ya existe un usuario con ese nombre" });
        expect(client.authUsers).toHaveLength(before);
        expect(client.profiles).toHaveLength(PROFILES.length);
      });
    });

    it("si el insert del perfil falla, se deshace el usuario de Auth", async () => {
      await withSeed({}, async (client) => {
        const before = client.authUsers.length;
        client.withError("profiles", { message: "tabla caída" }, { op: "insert" });

        const res = await app.request(
          "/v1/teachers",
          json("POST", { fullName: "Nuevo Docente", username: "nuevo.docente", temporaryPassword: "clave-temporal-1" }, client.staffSession(ADMIN).headers),
        );
        expect(res.status).toBe(500);
        expect(client.authUsers).toHaveLength(before); // la cuenta huérfana se borró
        expect(client.profiles.find((row) => row.username === "nuevo.docente")).toBeUndefined();
      });
    });
  });

  describe("GET /v1/teachers/:id", () => {
    it("un profesor no ve el detalle de otro (403)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, { headers: client.staffSession(CARLOS).headers });
        expect(res.status).toBe(403);
      });
    });

    it("un id que no existe responde 404", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request("/v1/teachers/ffffffff-0000-4000-8000-000000000099", {
          headers: client.staffSession(ADMIN).headers,
        });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "Profesor no encontrado" });
      });
    });

    it("un admin no es profesor para este recurso (404)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${ADMIN}`, { headers: client.staffSession(ADMIN).headers });
        expect(res.status).toBe(404);
      });
    });

    it("devuelve el perfil y sus asignaciones, sin credenciales", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, { headers: client.staffSession(ADMIN).headers });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body).toEqual({
          id: LAURA,
          username: "laura.martinez",
          fullName: "Laura Martínez",
          active: true,
          assignments: [
            {
              subject: { id: PHYS, name: "Física" },
              group: { id: G2, label: "CLEI V · B", shift: "night", shiftLabel: "Noche", accessCode: "CENSA-5BN-8TZ" },
            },
            {
              subject: { id: MATH, name: "Matemáticas" },
              group: { id: G1, label: "CLEI IV · A", shift: "morning", shiftLabel: "Mañana", accessCode: "CENSA-4AM-K7Q" },
            },
          ],
        });
        // Ni el correo ni la contraseña salen nunca (admin-08: «no se muestra»).
        expect(body).not.toHaveProperty("email");
        expect(body).not.toHaveProperty("password");
      });
    });
  });

  describe("PATCH /v1/teachers/:id", () => {
    it("un profesor no edita (403)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          `/v1/teachers/${LAURA}`,
          json("PATCH", { fullName: "Editado Ajenamente" }, client.staffSession(CARLOS).headers),
        );
        expect(res.status).toBe(403);
      });
    });

    it("sin cambios responde 400", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, json("PATCH", {}, client.staffSession(ADMIN).headers));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "No se envió ningún cambio" });
      });
    });

    it("cambia el nombre completo", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          `/v1/teachers/${LAURA}`,
          json("PATCH", { fullName: "Laura Martínez Gómez" }, client.staffSession(ADMIN).headers),
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
          id: LAURA,
          username: "laura.martinez",
          fullName: "Laura Martínez Gómez",
          active: true,
        });
        expect(client.profiles.find((row) => row.id === LAURA)?.full_name).toBe("Laura Martínez Gómez");
      });
    });

    it("cambia el usuario: el perfil y el correo de Auth van juntos", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, json("PATCH", { username: "laura.m" }, client.staffSession(ADMIN).headers));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ username: "laura.m" });

        expect(client.profiles.find((row) => row.id === LAURA)).toMatchObject({
          username: "laura.m",
          email: `laura.m@${DOMAIN}`,
        });
        // Sin esto, el login con el usuario nuevo no encontraría la cuenta (ADR 0006).
        expect(client.authUsers.find((row) => row.id === LAURA)?.email).toBe(`laura.m@${DOMAIN}`);
      });
    });

    it("un usuario ya dado de alta responde 409", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, json("PATCH", { username: "carlos.ramirez" }, client.staffSession(ADMIN).headers));
        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({ error: "Ya existe un usuario con ese nombre" });
      });
    });
  });

  describe("DELETE /v1/teachers/:id", () => {
    it("un profesor no elimina (403)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, {
          method: "DELETE",
          headers: client.staffSession(CARLOS).headers,
        });
        expect(res.status).toBe(403);
      });
    });

    it("no se puede eliminar uno a sí mismo (403)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${ADMIN}`, {
          method: "DELETE",
          headers: client.staffSession(ADMIN).headers,
        });
        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ error: "No puedes eliminarte a ti mismo" });
      });
    });

    it("borra el usuario y el perfil; las materias quedan sin docente y las guías se conservan", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, {
          method: "DELETE",
          headers: client.staffSession(ADMIN).headers,
        });
        expect(res.status).toBe(204);

        expect(client.profiles.find((row) => row.id === LAURA)).toBeUndefined();
        expect(client.authUsers.find((row) => row.id === LAURA)).toBeUndefined();
        expect(client.subjects.filter((row) => row.teacher_id === LAURA)).toHaveLength(0);
        expect(client.subjects.find((row) => row.id === MATH)?.teacher_id).toBeNull();
        expect(client.subjects.find((row) => row.id === PHYS)?.teacher_id).toBeNull();
        // admin-10: «Las guías publicadas se conservan».
        expect(client.guides.find((row) => row.id === G_PUB)).toBeDefined();
      });
    });

    it("si Auth no deja borrar, no se toca nada (500)", async () => {
      // Perfil sin usuario en Auth: en producción la FK lo impide; aquí simula el fallo.
      await withSeed({ authUsers: AUTH_USERS.filter((user) => user.id !== LAURA) }, async (client) => {
        const res = await app.request(`/v1/teachers/${LAURA}`, {
          method: "DELETE",
          headers: client.staffSession(ADMIN).headers,
        });
        expect(res.status).toBe(500);
        expect(client.profiles.find((row) => row.id === LAURA)).toBeDefined();
      });
    });
  });

  describe("POST /v1/teachers/:id/password", () => {
    it("un profesor no restablece contraseñas (403)", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          `/v1/teachers/${LAURA}/password`,
          json("POST", { password: "otra-clave-123" }, client.staffSession(CARLOS).headers),
        );
        expect(res.status).toBe(403);
      });
    });

    it("una contraseña corta responde 400", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          `/v1/teachers/${LAURA}/password`,
          json("POST", { password: "corta" }, client.staffSession(ADMIN).headers),
        );
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Contraseña no válida" });
      });
    });

    it("cambia la contraseña en Auth y no la devuelve", async () => {
      await withSeed({}, async (client) => {
        const res = await app.request(
          `/v1/teachers/${LAURA}/password`,
          json("POST", { password: "otra-clave-123" }, client.staffSession(ADMIN).headers),
        );
        expect(res.status).toBe(204);
        expect(await res.text()).toBe("");

        expect(client.authUsers.find((row) => row.id === LAURA)?.password).toBe("otra-clave-123");
        // El resto de cuentas no se tocan.
        expect(client.authUsers.find((row) => row.id === CARLOS)?.password).toBe("clave-inicial-123");
      });
    });
  });
});
