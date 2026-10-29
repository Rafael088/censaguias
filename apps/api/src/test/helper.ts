import type { Hono } from "hono";
import { createApp } from "../app.js";
import { setSupabaseForTests } from "../lib/supabase.js";
import { STUDENT_COOKIE, signStudentSession, type StudentSession } from "../lib/student-session.js";
import { createFakeSupabase, type FakeData } from "./fake-supabase.js";

// env() exige estas variables y se cachea al primer uso: se fijan aquí para que los tests
// corran sin .env ni proyecto real. El Supabase es simulado, así que nadie sale a la red.
process.env.SUPABASE_URL ??= "https://tests.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-de-prueba";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-de-prueba";
process.env.STUDENT_SESSION_SECRET ??= "secreto-de-prueba-de-al-menos-32-caracteres!!";

/** Datos de ejemplo: un admin, dos profesores (uno desactivado) y un grupo con dos materias. */
export const IDS = {
  admin: "00000000-0000-4000-8000-000000000001",
  teacher: "00000000-0000-4000-8000-000000000002",
  otherTeacher: "00000000-0000-4000-8000-000000000003",
  inactiveTeacher: "00000000-0000-4000-8000-000000000004",
  group: "10000000-0000-4000-8000-000000000001",
  math: "20000000-0000-4000-8000-000000000001",
  science: "20000000-0000-4000-8000-000000000002",
} as const;

export const SEED: FakeData = {
  profiles: [
    { id: IDS.admin, username: "maria.lopez", full_name: "María López", role: "admin", active: true },
    { id: IDS.teacher, username: "laura.martinez", full_name: "Laura Martínez", role: "teacher", active: true },
    { id: IDS.otherTeacher, username: "carlos.rojas", full_name: "Carlos Rojas", role: "teacher", active: true },
    { id: IDS.inactiveTeacher, username: "profesor.baja", full_name: "Profe De Baja", role: "teacher", active: false },
  ],
  groups: [
    {
      id: IDS.group,
      clei: 4,
      identifier: "A",
      shift: "morning",
      school_year: 2026,
      access_code: "CENSA-4AM-K7Q",
      code_version: 1,
    },
  ],
  subjects: [
    { id: IDS.math, group_id: IDS.group, name: "Matemáticas", teacher_id: IDS.teacher },
    { id: IDS.science, group_id: IDS.group, name: "Ciencias Naturales", teacher_id: IDS.otherTeacher },
  ],
  guides: [],
  authTokens: {
    "token-admin": IDS.admin,
    "token-teacher": IDS.teacher,
    "token-teacher2": IDS.otherTeacher,
    "token-inactive": IDS.inactiveTeacher,
  },
};

/** Sesiones falsas de staff: el token no se valida con Supabase, lo resuelve el simulado. */
export const tokens = {
  admin: "token-admin",
  teacher: "token-teacher",
  otherTeacher: "token-teacher2",
  inactiveTeacher: "token-inactive",
  unknown: "token-que-no-existe",
} as const;

/** Cabecera de auth para pegar en los tests: `headers: bearer(tokens.admin)`. */
export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Cookie del estudiante firmada de verdad con el secreto de tests, para que `requireStudent`
 * la acepte igual que en producción. Por defecto apunta al grupo del seed con su código vigente.
 */
export async function studentCookie(session: Partial<StudentSession> = {}): Promise<string> {
  const token = await signStudentSession({
    groupId: session.groupId ?? IDS.group,
    codeVersion: session.codeVersion ?? 1,
  });
  return `${STUDENT_COOKIE}=${token}`;
}

/**
 * Una app del proyecto (rutas, middlewares y errores reales) con Supabase simulado detrás.
 * Cada llamada devuelve una instancia nueva, para que un test pueda montar rutas extra
 * sin arrastrar las de otro. Pasa tus datos cuando el caso necesite algo distinto al seed.
 */
export function createTestApp(data: FakeData = structuredClone(SEED)): { app: Hono; data: FakeData } {
  setSupabaseForTests(createFakeSupabase(data));
  return { app: createApp(), data };
}
