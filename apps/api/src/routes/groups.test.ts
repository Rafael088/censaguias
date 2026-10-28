import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase } from "../lib/testing.js";

const ADMIN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_ID = "bbbbbbbb-0000-4000-8000-000000000002";
const G1 = "cccccccc-0000-4000-8000-000000000010"; // CLEI IV · A · Mañana
const G2 = "cccccccc-0000-4000-8000-000000000020"; // CLEI V · B · Noche
const G3 = "cccccccc-0000-4000-8000-000000000030"; // CLEI VI · A · Sabatina
const GONE = "ffffffff-0000-4000-8000-000000000099";
const ALGEBRA = "dddddddd-0000-4000-8000-000000000101";
const FISICA = "dddddddd-0000-4000-8000-000000000102";
const HISTORIA = "dddddddd-0000-4000-8000-000000000103";

let db: FakeSupabase;

beforeAll(() => {
  db = fakeSupabase({
    profiles: [
      { id: ADMIN_ID, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
      { id: TEACHER_ID, username: "luis.docente", full_name: "Luis Docente", role: "teacher", active: true },
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
        created_at: "2026-01-03T10:00:00.000Z",
      },
      {
        id: G2,
        clei: 5,
        identifier: "B",
        shift: "night",
        school_year: 2026,
        access_code: "CENSA-5BN-2T7",
        code_version: 1,
        created_at: "2026-01-02T10:00:00.000Z",
      },
      {
        id: G3,
        clei: 6,
        identifier: "A",
        shift: "saturday",
        school_year: 2026,
        access_code: "CENSA-6AS-9PK",
        code_version: 1,
        created_at: "2026-01-01T10:00:00.000Z",
      },
    ],
    subjects: [
      { id: ALGEBRA, group_id: G1, name: "Álgebra", description: "Números y ecuaciones", teacher_id: TEACHER_ID },
      { id: FISICA, group_id: G1, name: "Física", description: null, teacher_id: TEACHER_ID },
      { id: HISTORIA, group_id: G2, name: "Historia", description: null, teacher_id: TEACHER_ID },
    ],
    guides: [
      { subject_id: ALGEBRA, status: "published" },
      { subject_id: ALGEBRA, status: "published" },
      { subject_id: ALGEBRA, status: "draft" },
      { subject_id: FISICA, status: "published" },
      { subject_id: HISTORIA, status: "draft" },
    ],
    storage: {
      guides: [
        `${G1}/${ALGEBRA}/guia-1.pdf`,
        `${G1}/${ALGEBRA}/guia-2.pdf`,
        `${G1}/${FISICA}/guia-3.pdf`,
        `${G2}/${HISTORIA}/guia-4.pdf`,
      ],
    },
  });
});

afterAll(() => db.restore());

const admin = () => db.staffSession(ADMIN_ID).headers;
const teacher = () => db.staffSession(TEACHER_ID).headers;

const json = (metodo: string, body: unknown, headers: Record<string, string> = {}) => ({
  method: metodo,
  headers: { "Content-Type": "application/json", ...headers },
  body: JSON.stringify(body),
});

const call = (path: string, init: RequestInit = {}) => app.request(path, init);

type Ruta = { metodo: string; ruta: string; body?: unknown };
const RUTAS: Ruta[] = [
  { metodo: "GET", ruta: "/v1/groups" },
  { metodo: "GET", ruta: `/v1/groups/${G1}` },
  { metodo: "POST", ruta: "/v1/groups", body: { clei: 1, identifier: "Z", shift: "morning", schoolYear: 2026 } },
  { metodo: "PATCH", ruta: `/v1/groups/${G1}`, body: { schoolYear: 2027 } },
  { metodo: "DELETE", ruta: `/v1/groups/${G1}` },
  { metodo: "POST", ruta: `/v1/groups/${G1}/code` },
];

const llamar = (ruta: Ruta, headers: Record<string, string> = {}) =>
  app.request(
    ruta.ruta,
    ruta.body === undefined
      ? { method: ruta.metodo, headers }
      : { method: ruta.metodo, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(ruta.body) },
  );

describe("Permisos", () => {
  it("las seis rutas de grupo piden sesión", async () => {
    for (const ruta of RUTAS) {
      const res = await llamar(ruta);
      expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(401);
      expect(await res.json()).toEqual({ error: "Falta sesión" });
    }
  });

  it("las seis rutas de grupo son solo del administrador", async () => {
    for (const ruta of RUTAS) {
      const res = await llamar(ruta, teacher());
      expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(403);
      expect(await res.json()).toEqual({ error: "Sin permiso" });
    }
  });
});

describe("GET /v1/groups", () => {
  it("lista los grupos con su etiqueta, su código y su número de materias", async () => {
    const res = await call("/v1/groups", { headers: admin() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(12);
    // Los más recientes primero: así la lista no da saltos entre páginas.
    expect(body.items.map((group: { id: string }) => group.id)).toEqual([G1, G2, G3]);
    expect(body.items[0]).toEqual({
      id: G1,
      clei: 4,
      identifier: "A",
      label: "CLEI IV · A",
      shift: "morning",
      shiftLabel: "Mañana",
      schoolYear: 2026,
      accessCode: "CENSA-4AM-K7Q",
      codeVersion: 1,
      subjects: 2,
    });
    expect(body.items[2]).toMatchObject({ id: G3, label: "CLEI VI · A", shiftLabel: "Sabatina", subjects: 0 });
  });

  it("pagina sin perder el total", async () => {
    const res = await call("/v1/groups?page=2&pageSize=2", { headers: admin() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.page).toBe(2);
    expect(body.items.map((group: { id: string }) => group.id)).toEqual([G3]);
  });

  it("busca por código", async () => {
    const res = await call("/v1/groups?q=censa-4am", { headers: admin() });
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].id).toBe(G1);
  });

  it("busca por CLEI, en número o en romano", async () => {
    const romano = await call("/v1/groups?q=IV", { headers: admin() });
    expect((await romano.json()).items.map((group: { id: string }) => group.id)).toEqual([G1]);

    const numero = await call("/v1/groups?q=5", { headers: admin() });
    expect((await numero.json()).items.map((group: { id: string }) => group.id)).toEqual([G2]);
  });

  it("filtra por jornada", async () => {
    const res = await call("/v1/groups?shift=night", { headers: admin() });
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.items[0].shiftLabel).toBe("Noche");
  });

  it("un texto que no significa nada no filtra (mejor devolver la lista que nada)", async () => {
    const res = await call(`/v1/groups?q=${encodeURIComponent("###")}`, { headers: admin() });
    expect((await res.json()).total).toBe(3);
  });
});

describe("POST /v1/groups", () => {
  it("crea el grupo con un código nuevo y lo devuelve con 201", async () => {
    const res = await call("/v1/groups", json("POST", { clei: 5, identifier: "C", shift: "morning", schoolYear: 2026 }, admin()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      clei: 5,
      identifier: "C",
      label: "CLEI V · C",
      shiftLabel: "Mañana",
      schoolYear: 2026,
      codeVersion: 1,
      subjects: 0,
    });
    expect(body.accessCode).toMatch(/^CENSA-5CM-[A-HJKMNP-Z2-9]{3}$/);
    expect(db.groups.find((group) => group.id === body.id)).toMatchObject({
      access_code: body.accessCode,
      created_by: ADMIN_ID,
    });
  });

  it("rechaza datos que no valen", async () => {
    const res = await call("/v1/groups", json("POST", { clei: 9, identifier: "A", shift: "morning", schoolYear: 2026 }, admin()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Datos del grupo no válidos" });
  });

  it("si el código choca, inventa otro y crea el grupo", async () => {
    // Lo que la base real contestaría con un choque de access_code.
    db.withError(
      "groups",
      {
        message: "duplicate key value violates unique constraint",
        code: "23505",
        details: "Key (access_code)=(CENSA-4DN-AAA) already exists.",
      },
      { op: "insert" },
    );

    const res = await call("/v1/groups", json("POST", { clei: 4, identifier: "D", shift: "night", schoolYear: 2027 }, admin()));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.accessCode).toMatch(/^CENSA-4DN-[A-HJKMNP-Z2-9]{3}$/);
    expect(db.groups.filter((group) => group.identifier === "D")).toHaveLength(1);
  });

  it("no acepta dos grupos con el mismo CLEI, identificador, jornada y año", async () => {
    db.withError(
      "groups",
      {
        message: "duplicate key value violates unique constraint",
        code: "23505",
        details: "Key (clei, identifier, shift, school_year)=(4, A, morning, 2026) already exists.",
      },
      { op: "insert" },
    );

    const res = await call("/v1/groups", json("POST", { clei: 4, identifier: "A", shift: "morning", schoolYear: 2026 }, admin()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Ya existe un grupo con estos datos" });
  });
});

describe("GET /v1/groups/:id", () => {
  it("devuelve el detalle con materias, docente y guías publicadas", async () => {
    const res = await call(`/v1/groups/${G1}`, { headers: admin() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: G1, label: "CLEI IV · A", accessCode: "CENSA-4AM-K7Q", codeVersion: 1 });
    expect(body.subjects).toEqual([
      {
        id: ALGEBRA,
        name: "Álgebra",
        description: "Números y ecuaciones",
        teacher: { id: TEACHER_ID, fullName: "Luis Docente" },
        publishedGuides: 2,
      },
      {
        id: FISICA,
        name: "Física",
        description: null,
        teacher: { id: TEACHER_ID, fullName: "Luis Docente" },
        publishedGuides: 1,
      },
    ]);
  });

  it("404 si el grupo no existe", async () => {
    const res = await call(`/v1/groups/${GONE}`, { headers: admin() });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Grupo no encontrado" });
  });

  it("404 si el id ni siquiera es un uuid", async () => {
    const res = await call("/v1/groups/no-uuid", { headers: admin() });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Grupo no encontrado" });
  });
});

describe("PATCH /v1/groups/:id", () => {
  it("actualiza los datos y deja el código como estaba", async () => {
    const res = await call(`/v1/groups/${G2}`, json("PATCH", { identifier: "C", schoolYear: 2027 }, admin()));
    expect(res.status).toBe(200);
    const body = await res.json();
    // El Figma dice que cambiar el identificador o la jornada NO cambia el código solo.
    expect(body).toMatchObject({
      id: G2,
      clei: 5,
      identifier: "C",
      label: "CLEI V · C",
      schoolYear: 2027,
      accessCode: "CENSA-5BN-2T7",
      subjects: 1,
    });
    expect(db.groups.find((group) => group.id === G2)).toMatchObject({
      identifier: "C",
      school_year: 2027,
      access_code: "CENSA-5BN-2T7",
    });
  });

  it("rechaza un PATCH sin cambios", async () => {
    const res = await call(`/v1/groups/${G2}`, json("PATCH", {}, admin()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "No se envió ningún cambio" });
  });

  it("404 si el grupo no existe", async () => {
    const res = await call(`/v1/groups/${GONE}`, json("PATCH", { schoolYear: 2027 }, admin()));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Grupo no encontrado" });
  });

  it("409 si esos datos ya los tiene otro grupo", async () => {
    db.withError(
      "groups",
      {
        message: "duplicate key value violates unique constraint",
        code: "23505",
        details: "Key (clei, identifier, shift, school_year)=(4, A, morning, 2026) already exists.",
      },
      { op: "update" },
    );

    const res = await call(
      `/v1/groups/${G2}`,
      json("PATCH", { clei: 4, identifier: "A", shift: "morning", schoolYear: 2026 }, admin()),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Ya existe un grupo con estos datos" });
    // La actualización no llegó a aplicarse.
    expect(db.groups.find((group) => group.id === G2)).toMatchObject({ identifier: "C" });
  });
});

describe("POST /v1/groups/:id/code", () => {
  it("regenera el código y sube la versión", async () => {
    const res = await call(`/v1/groups/${G1}/code`, { method: "POST", headers: admin() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessCode).toMatch(/^CENSA-4AM-[A-HJKMNP-Z2-9]{3}$/);
    expect(body.codeVersion).toBe(2);
    expect(db.groups.find((group) => group.id === G1)).toMatchObject({ code_version: 2 });
  });

  it("si el código choca con otro grupo, inventa otro y sigue", async () => {
    db.withError(
      "groups",
      {
        message: "duplicate key value violates unique constraint",
        code: "23505",
        details: "Key (access_code)=(CENSA-4AM-K7Q) already exists.",
      },
      { op: "update" },
    );

    const res = await call(`/v1/groups/${G1}/code`, { method: "POST", headers: admin() });
    expect(res.status).toBe(200);
    expect((await res.json()).codeVersion).toBe(3);
  });

  it("404 si el grupo no existe", async () => {
    const res = await call(`/v1/groups/${GONE}/code`, { method: "POST", headers: admin() });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Grupo no encontrado" });
  });
});

describe("DELETE /v1/groups/:id", () => {
  it("borra el grupo y también sus PDF", async () => {
    const res = await call(`/v1/groups/${G1}`, { method: "DELETE", headers: admin() });
    expect(res.status).toBe(204);
    expect(db.groups.some((group) => group.id === G1)).toBe(false);
    expect(db.removed).toEqual([
      `${G1}/${ALGEBRA}/guia-1.pdf`,
      `${G1}/${ALGEBRA}/guia-2.pdf`,
      `${G1}/${FISICA}/guia-3.pdf`,
    ]);
    expect(db.files).toEqual([`${G2}/${HISTORIA}/guia-4.pdf`]);
  });

  it("404 si el grupo no existe", async () => {
    const res = await call(`/v1/groups/${GONE}`, { method: "DELETE", headers: admin() });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Grupo no encontrado" });
  });

  it("si Storage no deja listar los PDF, no se borra nada", async () => {
    db.withStorageError("guides", "list", { message: "storage caído" });

    const res = await call(`/v1/groups/${G2}`, { method: "DELETE", headers: admin() });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno" });
    expect(db.groups.some((group) => group.id === G2)).toBe(true);
    expect(db.files).toContain(`${G2}/${HISTORIA}/guia-4.pdf`);
  });

  it("si Storage falla al borrar, el grupo sí desaparece y los archivos quedan huérfanos", async () => {
    db.withStorageError("guides", "remove", { message: "storage caído" });

    const res = await call(`/v1/groups/${G2}`, { method: "DELETE", headers: admin() });
    expect(res.status).toBe(204);
    expect(db.groups.some((group) => group.id === G2)).toBe(false);
    // Ninguna ruta se borró: la API prefiere archivos huérfanos invisibles a un grupo borrado a medias.
    expect(db.files).toContain(`${G2}/${HISTORIA}/guia-4.pdf`);
    expect(db.removed).not.toContain(`${G2}/${HISTORIA}/guia-4.pdf`);
  });
});
