import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { fakeSupabase, type FakeSupabase } from "../lib/testing.js";

const ADMIN_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_ID = "bbbbbbbb-0000-4000-8000-000000000002";
const OTHER_TEACHER = "bbbbbbbb-0000-4000-8000-000000000003";
const INACTIVE_TEACHER = "bbbbbbbb-0000-4000-8000-000000000004";
const G1 = "cccccccc-0000-4000-8000-000000000010"; // CLEI IV · A · Mañana
const GONE = "ffffffff-0000-4000-8000-000000000099";
const ALGEBRA = "dddddddd-0000-4000-8000-000000000101";
const FISICA = "dddddddd-0000-4000-8000-000000000102";

let db: FakeSupabase;

beforeAll(() => {
  db = fakeSupabase({
    profiles: [
      { id: ADMIN_ID, username: "ana.admin", full_name: "Ana Admin", role: "admin", active: true },
      { id: TEACHER_ID, username: "luis.docente", full_name: "Luis Docente", role: "teacher", active: true },
      { id: OTHER_TEACHER, username: "carlos.docente", full_name: "Carlos Docente", role: "teacher", active: true },
      { id: INACTIVE_TEACHER, username: "de.baja", full_name: "De Baja", role: "teacher", active: false },
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
      },
    ],
    subjects: [
      { id: ALGEBRA, group_id: G1, name: "Álgebra", description: "Números y ecuaciones", teacher_id: TEACHER_ID },
      { id: FISICA, group_id: G1, name: "Física", description: null, teacher_id: TEACHER_ID },
    ],
    guides: [
      { subject_id: ALGEBRA, status: "published" },
      { subject_id: ALGEBRA, status: "published" },
      { subject_id: ALGEBRA, status: "draft" },
      { subject_id: FISICA, status: "draft" },
    ],
    storage: {
      guides: [`${G1}/${ALGEBRA}/guia-1.pdf`, `${G1}/${ALGEBRA}/guia-2.pdf`, `${G1}/${FISICA}/guia-3.pdf`],
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
  { metodo: "GET", ruta: `/v1/groups/${G1}/subjects` },
  { metodo: "POST", ruta: `/v1/groups/${G1}/subjects`, body: { name: "Química", teacherId: TEACHER_ID } },
  { metodo: "PATCH", ruta: `/v1/subjects/${ALGEBRA}`, body: { name: "Álgebra II" } },
  { metodo: "PUT", ruta: `/v1/subjects/${ALGEBRA}/teachers`, body: { teacherId: TEACHER_ID } },
  { metodo: "DELETE", ruta: `/v1/subjects/${ALGEBRA}` },
];

const llamar = (ruta: Ruta, headers: Record<string, string> = {}) =>
  app.request(
    ruta.ruta,
    ruta.body === undefined
      ? { method: ruta.metodo, headers }
      : { method: ruta.metodo, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(ruta.body) },
  );

describe("Permisos", () => {
  it("las cinco rutas de materia piden sesión", async () => {
    for (const ruta of RUTAS) {
      const res = await llamar(ruta);
      expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(401);
      expect(await res.json()).toEqual({ error: "Falta sesión" });
    }
  });

  it("las cinco rutas de materia son solo del administrador", async () => {
    for (const ruta of RUTAS) {
      const res = await llamar(ruta, teacher());
      expect(res.status, `${ruta.metodo} ${ruta.ruta}`).toBe(403);
      expect(await res.json()).toEqual({ error: "Sin permiso" });
    }
  });
});

describe("GET /v1/groups/:id/subjects", () => {
  it("lista las materias con su docente y sus guías publicadas", async () => {
    const res = await call(`/v1/groups/${G1}/subjects`, { headers: admin() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([
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
        publishedGuides: 0,
      },
    ]);
  });

  it("404 si el grupo no existe", async () => {
    const res = await call(`/v1/groups/${GONE}/subjects`, { headers: admin() });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Grupo no encontrado" });
  });
});

describe("POST /v1/groups/:id/subjects", () => {
  it("crea la materia con su docente y la devuelve con 201", async () => {
    const res = await call(
      `/v1/groups/${G1}/subjects`,
      json("POST", { name: "Química", description: "Materiales", teacherId: OTHER_TEACHER }, admin()),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: expect.any(String),
      name: "Química",
      description: "Materiales",
      teacher: { id: OTHER_TEACHER, fullName: "Carlos Docente" },
      publishedGuides: 0,
    });
    expect(db.subjects.some((subject) => subject.name === "Química" && subject.teacher_id === OTHER_TEACHER)).toBe(true);
  });

  it("rechaza datos que no valen", async () => {
    const res = await call(`/v1/groups/${G1}/subjects`, json("POST", { name: "X", teacherId: TEACHER_ID }, admin()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Datos de la materia no válidos" });
  });

  it("rechaza un docente que no existe, no es profesor o no está activo", async () => {
    const inactiva = await call(
      `/v1/groups/${G1}/subjects`,
      json("POST", { name: "Música", teacherId: INACTIVE_TEACHER }, admin()),
    );
    expect(inactiva.status).toBe(400);
    expect(await inactiva.json()).toEqual({ error: "El docente no existe o no está activo" });

    const adminComoDocente = await call(
      `/v1/groups/${G1}/subjects`,
      json("POST", { name: "Música", teacherId: ADMIN_ID }, admin()),
    );
    expect(adminComoDocente.status).toBe(400);
  });

  it("409 si el grupo ya tiene una materia con ese nombre", async () => {
    db.withError(
      "subjects",
      { message: "duplicate key value violates unique constraint", code: "23505", details: "Key (group_id, name)" },
      { op: "insert" },
    );
    const res = await call(`/v1/groups/${G1}/subjects`, json("POST", { name: "Álgebra", teacherId: TEACHER_ID }, admin()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Ya existe una materia con ese nombre en el grupo" });
  });

  it("404 si el grupo no existe", async () => {
    const res = await call(`/v1/groups/${GONE}/subjects`, json("POST", { name: "Química", teacherId: TEACHER_ID }, admin()));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /v1/subjects/:id", () => {
  it("actualiza nombre y descripción", async () => {
    const res = await call(
      `/v1/subjects/${ALGEBRA}`,
      json("PATCH", { name: "Álgebra Lineal", description: "Vectores" }, admin()),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: ALGEBRA,
      name: "Álgebra Lineal",
      description: "Vectores",
      teacher: { id: TEACHER_ID, fullName: "Luis Docente" },
    });
    expect(db.subjects.find((subject) => subject.id === ALGEBRA)).toMatchObject({
      name: "Álgebra Lineal",
      description: "Vectores",
    });
  });

  it("permite quitar la descripción con null", async () => {
    const res = await call(`/v1/subjects/${ALGEBRA}`, json("PATCH", { description: null }, admin()));
    expect(res.status).toBe(200);
    expect((await res.json()).description).toBeNull();
    expect(db.subjects.find((subject) => subject.id === ALGEBRA)?.description).toBeNull();
  });

  it("rechaza un PATCH sin cambios", async () => {
    const res = await call(`/v1/subjects/${ALGEBRA}`, json("PATCH", {}, admin()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "No se envió ningún cambio" });
  });

  it("404 si la materia no existe", async () => {
    const res = await call(`/v1/subjects/${GONE}`, json("PATCH", { name: "Álgebra" }, admin()));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Materia no encontrada" });
  });

  it("409 si ese nombre ya lo tiene otra materia del grupo", async () => {
    db.withError(
      "subjects",
      { message: "duplicate key value violates unique constraint", code: "23505", details: "Key (group_id, name)" },
      { op: "update" },
    );
    const res = await call(`/v1/subjects/${FISICA}`, json("PATCH", { name: "Álgebra Lineal" }, admin()));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Ya existe una materia con ese nombre en el grupo" });
  });
});

describe("PUT /v1/subjects/:id/teachers", () => {
  it("cambia el docente de la materia", async () => {
    const res = await call(`/v1/subjects/${ALGEBRA}/teachers`, json("PUT", { teacherId: OTHER_TEACHER }, admin()));
    expect(res.status).toBe(200);
    expect((await res.json()).teacher).toEqual({ id: OTHER_TEACHER, fullName: "Carlos Docente" });
    expect(db.subjects.find((subject) => subject.id === ALGEBRA)?.teacher_id).toBe(OTHER_TEACHER);
  });

  it("permite dejar la materia sin docente con null", async () => {
    const res = await call(`/v1/subjects/${ALGEBRA}/teachers`, json("PUT", { teacherId: null }, admin()));
    expect(res.status).toBe(200);
    expect((await res.json()).teacher).toBeNull();
    expect(db.subjects.find((subject) => subject.id === ALGEBRA)?.teacher_id).toBeNull();
  });

  it("rechaza un docente que no es profesor o no está activo", async () => {
    const res = await call(`/v1/subjects/${ALGEBRA}/teachers`, json("PUT", { teacherId: ADMIN_ID }, admin()));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El docente no existe o no está activo" });
  });

  it("404 si la materia no existe", async () => {
    const res = await call(`/v1/subjects/${GONE}/teachers`, json("PUT", { teacherId: TEACHER_ID }, admin()));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Materia no encontrada" });
  });
});

describe("DELETE /v1/subjects/:id", () => {
  it("borra la materia y también sus PDF", async () => {
    const res = await call(`/v1/subjects/${FISICA}`, { method: "DELETE", headers: admin() });
    expect(res.status).toBe(204);
    expect(db.subjects.some((subject) => subject.id === FISICA)).toBe(false);
    expect(db.removed).toEqual([`${G1}/${FISICA}/guia-3.pdf`]);
  });

  it("404 si la materia no existe", async () => {
    const res = await call(`/v1/subjects/${GONE}`, { method: "DELETE", headers: admin() });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Materia no encontrada" });
  });

  it("si Storage no deja listar los PDF, no se borra nada", async () => {
    db.withStorageError("guides", "list", { message: "storage caído" });
    const res = await call(`/v1/subjects/${ALGEBRA}`, { method: "DELETE", headers: admin() });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno" });
    expect(db.subjects.some((subject) => subject.id === ALGEBRA)).toBe(true);
    expect(db.files).toContain(`${G1}/${ALGEBRA}/guia-1.pdf`);
  });
});
