/**
 * Capa de datos del espacio estudiante (WEB-02b).
 *
 * Todas las llamadas pasan por el cliente tipado `api` (hc<AppType>, ADR 0002):
 * rutas y respuestas salen del tipo de Hono, no se escriben dos veces.
 *
 * Rutas usadas: GET /v1/student/group, GET /v1/student/subjects/:id/guides,
 * GET /v1/student/guides/:id y GET /v1/guides/:id/file. La sesión del estudiante
 * viaja por cookie; el cliente de Hono la reenvía con `credentials: "include"`.
 *
 * Las respuestas de la API se mapean a los tipos del front: el backend devuelve
 * `teacher: { fullName } | null` y `group` con campos completos; el front usa
 * `teacher: string | null` y `StudentGroup` con label, shift, schoolYear y code.
 */

import { api } from "./api";

/** 401: no hay sesión (o el código cambió). La pantalla redirige al acceso. */
export class NoSessionError extends Error {
  constructor() {
    super("Sin sesión de estudiante");
    this.name = "NoSessionError";
  }
}

/** Devuelve el JSON de una respuesta 200, o lanza NoSessionError / Error. */
async function ok<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new NoSessionError();
  if (!res.ok) throw new Error(`La API respondió ${res.status}`);
  return (await res.json()) as T;
}

// ---------- Tipos del front (mantenidos para que las páginas no cambien) ----------

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

/** Mapea el grupo de la API al tipo del front. */
function mapGroup(g: { label: string; shift: string; schoolYear: number; accessCode: string }): StudentGroup {
  return { label: g.label, shift: g.shift, schoolYear: g.schoolYear, code: g.accessCode };
}

/** Mapea una materia de la API al tipo del front. */
function mapSubject(s: { id: string; name: string; description: string | null; teacher: { fullName: string } | null; publishedGuides: number }): StudentSubject {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    teacher: s.teacher?.fullName ?? null,
    guideCount: s.publishedGuides,
  };
}

/** Mapea una guía de la API al tipo del front. */
function mapGuide(g: {
  id: string;
  topic: string;
  title: string;
  description: string;
  publishedAt: string;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  subject: { id: string; name: string };
  teacher: string | null;
}): StudentGuide {
  return {
    id: g.id,
    topic: g.topic,
    title: g.title,
    description: g.description,
    publishedAt: g.publishedAt,
    fileName: g.fileName,
    sizeBytes: g.sizeBytes,
    pageCount: g.pageCount,
    subject: g.subject,
    teacher: g.teacher,
  };
}

// ---------- Llamadas a la API ----------

/** Mis materias y Mi grupo: el grupo, sus materias con docente y recuento, y las
 *  últimas guías publicadas del grupo (pantallas estudiante-01 y estudiante-05). */
export async function getStudentOverview(): Promise<StudentOverview | null> {
  try {
    const res = await api.v1.student.group.$get();
    if (res.status === 401) throw new NoSessionError();
    if (!res.ok) throw new Error(`La API respondió ${res.status}`);
    const data = await res.json();
    return {
      group: mapGroup(data.group),
      subjects: data.subjects.map(mapSubject),
      latestGuides: data.recentGuides.map((g: { id: string; topic: string; title: string; publishedAt: string | null; fileName: string; sizeBytes: number; subject: { id: string; name: string | null } }) => ({
        id: g.id,
        topic: g.topic,
        title: g.title,
        description: "",
        publishedAt: g.publishedAt ?? "",
        fileName: g.fileName,
        sizeBytes: g.sizeBytes,
        pageCount: null,
        subject: { id: g.subject.id, name: g.subject.name ?? "" },
        teacher: null,
      })),
      guideCount: data.totalPublishedGuides,
    };
  } catch (err) {
    if (err instanceof NoSessionError) throw err;
    console.warn("[WEB-02b] No se pudo cargar el grupo del estudiante:", err);
    return null;
  }
}

/** Guías de una materia con resumen (pantalla estudiante-02). */
export async function getStudentSubject(id: string): Promise<StudentSubjectDetail | null> {
  try {
    const res = await api.v1.student.subjects[":id"].guides.$get({ param: { id }, query: {} });
    if (res.status === 401) throw new NoSessionError();
    if (!res.ok) throw new Error(`La API respondió ${res.status}`);
    const data = await res.json();
    return {
      subject: {
        id: data.subject.id,
        name: data.subject.name,
        description: data.subject.description,
        teacher: data.subject.teacher?.fullName ?? null,
        guideCount: data.total,
      },
      group: mapGroup(data.subject.group),
      guides: data.items.map((g: { id: string; subjectId: string; topic: string; title: string; description: string; publishedAt: string | null; fileName: string; sizeBytes: number; pageCount: number | null }) => ({
        id: g.id,
        topic: g.topic,
        title: g.title,
        description: g.description,
        publishedAt: g.publishedAt ?? "",
        fileName: g.fileName,
        sizeBytes: g.sizeBytes,
        pageCount: g.pageCount,
        subject: { id: g.subjectId, name: data.subject.name },
        teacher: null,
      })),
      topics: data.topics,
    };
  } catch (err) {
    if (err instanceof NoSessionError) throw err;
    console.warn("[WEB-02b] No se pudo cargar la materia del estudiante:", err);
    return null;
  }
}

/** Detalle de una guía publicada (pantalla estudiante-03). */
export async function getStudentGuide(id: string): Promise<(StudentGuide & { group: StudentGroup }) | null> {
  try {
    const res = await api.v1.student.guides[":id"].$get({ param: { id } });
    if (res.status === 401) throw new NoSessionError();
    if (!res.ok) throw new Error(`La API respondió ${res.status}`);
    const data = await res.json();
    return {
      id: data.id,
      topic: data.topic,
      title: data.title,
      description: data.description,
      publishedAt: data.publishedAt ?? "",
      fileName: data.fileName,
      sizeBytes: data.sizeBytes,
      pageCount: data.pageCount,
      subject: { id: data.subject.id, name: data.subject.name },
      teacher: data.subject.teacher?.fullName ?? null,
      group: mapGroup(data.subject.group),
    };
  } catch (err) {
    if (err instanceof NoSessionError) throw err;
    console.warn("[WEB-02b] No se pudo cargar la guía del estudiante:", err);
    return null;
  }
}

/** URL firmada de 60 s para abrir o descargar el PDF. */
export async function getStudentGuideFile(
  id: string,
  download: boolean,
): Promise<{ url: string; fileName: string } | null> {
  try {
    const res = await api.v1.guides[":id"].file.$get({ param: { id } });
    if (res.status === 401) throw new NoSessionError();
    if (!res.ok) throw new Error(`La API respondió ${res.status}`);
    const data = await res.json();
    return { url: data.url, fileName: data.fileName };
  } catch (err) {
    if (err instanceof NoSessionError) throw err;
    console.warn("[WEB-02b] No se pudo obtener el archivo de la guía:", err);
    return null;
  }
}
