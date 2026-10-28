/**
 * Capa de datos del espacio estudiante (WEB-02).
 *
 * TODO(API-07): la API todavía no expone las rutas de estudiante de
 * docs/ARQUITECTURA.md (`GET /v1/student/group`,
 * `GET /v1/student/subjects/:id/guides`, `GET /v1/student/guides/:id` y
 * `GET /v1/guides/:id/file`). `probeApi()` comprueba si existen: si no, estas
 * funciones devuelven los datos de muestra del Figma (`student-demo.ts`) para
 * que las pantallas se puedan construir y revisar hoy mismo.
 *
 * Al entrar API-07: borra `student-demo.ts` y `apiDisponible`, y ajusta cada
 * `map*` contra la respuesta real (idealmente con `hc<AppType>` de
 * apps/web/lib/api.ts, según ADR 0002). Las páginas no cambian: solo llaman a
 * estas funciones. La guardia de sesión (401 → `/`) ya está escrita.
 */

import { DEMO_GUIDES, DEMO_GROUP, DEMO_SUBJECTS } from "./student-demo";

export interface StudentGroup {
  /** «CLEI IV · A» */
  label: string;
  /** «Mañana» */
  shift: string;
  schoolYear: number;
  /** «CENSA-4AM-K7Q» */
  code: string;
}

export interface StudentSubject {
  id: string;
  name: string;
  description: string | null;
  /** «Laura Martínez»; null si la materia quedó sin docente. */
  teacher: string | null;
  /** Guías publicadas de la materia (los estudiantes no ven borradores). */
  guideCount: number;
}

export interface StudentGuide {
  id: string;
  topic: string;
  title: string;
  description: string;
  /** Fecha ISO «2026-10-14». */
  publishedAt: string;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  subject: { id: string; name: string };
  teacher: string | null;
}

export interface StudentOverview {
  group: StudentGroup;
  subjects: StudentSubject[];
  /** «Últimas guías publicadas». */
  latestGuides: StudentGuide[];
  /** Guías publicadas del grupo entero. */
  guideCount: number;
}

export interface StudentSubjectDetail {
  subject: StudentSubject;
  group: StudentGroup;
  /** Publicadas de esa materia, más recientes primero. */
  guides: StudentGuide[];
  /** Temas distintos de la materia, para el filtro. */
  topics: string[];
}

/** 401: no hay sesión (o el código cambió). La pantalla redirige al acceso. */
export class NoSessionError extends Error {
  constructor() {
    super("Sin sesión de estudiante");
    this.name = "NoSessionError";
  }
}

/** La ruta todavía no existe en la API: se usan los datos de muestra. */
let apiDisponible: boolean | null = null;

async function probeApi(): Promise<boolean> {
  if (apiDisponible !== null) return apiDisponible;
  try {
    const res = await fetch("/api/v1/student/group", { credentials: "include" });
    // 200 (hay sesión) o 401 (la ruta existe y no la hay): en ambos la API está levantada.
    if (res.ok || res.status === 401) {
      apiDisponible = true;
      return true;
    }
  } catch {
    // Next no pudo reenviar a la API: se asume que aún no expone estas rutas.
  }
  apiDisponible = false;
  console.warn("[WEB-02] La API no expone todavía /v1/student/*: se usan datos de muestra (TODO · API-07).");
  return false;
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(path, { credentials: "include" });
  if (res.status === 401) throw new NoSessionError();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`La API respondió ${res.status} en ${path}`);
  // TODO(API-07): confirma los campos contra la respuesta real y sustituye esto por hc<AppType>().
  return (await res.json()) as T;
}

export async function getStudentOverview(): Promise<StudentOverview | null> {
  if (!(await probeApi())) return demoOverview();
  return getJson<StudentOverview>("/api/v1/student/group");
}

export async function getStudentSubject(id: string): Promise<StudentSubjectDetail | null> {
  if (!(await probeApi())) return demoSubject(id);
  return getJson<StudentSubjectDetail>(`/api/v1/student/subjects/${id}/guides`);
}

export async function getStudentGuide(id: string): Promise<(StudentGuide & { group: StudentGroup }) | null> {
  if (!(await probeApi())) return demoGuide(id);
  return getJson<StudentGuide & { group: StudentGroup }>(`/api/v1/student/guides/${id}`);
}

/** URL firmada de 60 s para abrir o descargar el PDF. */
export async function getStudentGuideFile(
  id: string,
  download: boolean,
): Promise<{ url: string; fileName: string } | null> {
  if (!(await probeApi())) {
    const guide = DEMO_GUIDES.find((g) => g.id === id);
    return guide ? { url: `/muestras/${guide.fileName}`, fileName: guide.fileName } : null;
  }
  return getJson<{ url: string; fileName: string }>(
    `/api/v1/guides/${id}/file${download ? "?download=1" : ""}`,
  );
}

/**
 * Salir / cambiar de código (DELETE /v1/access, sí existe en la API).
 * Si la API no está, no pasa nada: la cookie caduca sola y la pantalla de acceso manda.
 */
export async function leaveStudentGroup(): Promise<void> {
  try {
    await fetch("/api/v1/access", { method: "DELETE", credentials: "include" });
  } catch {
    console.warn("[WEB-02] No se pudo cerrar la sesión en la API; la cookie caducará por su cuenta.");
  }
}

// ---------- Datos de muestra (sustituidos por API-07) ----------

function demoOverview(): StudentOverview {
  return {
    group: DEMO_GROUP,
    subjects: DEMO_SUBJECTS,
    latestGuides: DEMO_GUIDES.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    guideCount: DEMO_GUIDES.length,
  };
}

function demoSubject(id: string): StudentSubjectDetail | null {
  const subject = DEMO_SUBJECTS.find((s) => s.id === id);
  if (!subject) return null;
  const guides = DEMO_GUIDES.filter((g) => g.subject.id === id).sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  const topics: string[] = [];
  for (const guide of guides) if (!topics.includes(guide.topic)) topics.push(guide.topic);
  return { subject, group: DEMO_GROUP, guides, topics };
}

function demoGuide(id: string) {
  const guide = DEMO_GUIDES.find((g) => g.id === id);
  return guide ? { ...guide, group: DEMO_GROUP } : null;
}
