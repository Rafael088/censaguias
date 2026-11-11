/**
 * Capa de datos del espacio del profesor (WEB-07).
 *
 * Todas las llamadas van a `/api/v1/...` con el Bearer token del staff (ADR 0003).
 * Se usa fetch directo (como `lib/student.ts`) porque varias rutas reciben
 * FormData (subida y reemplazo de PDF) y el cliente tipado de Hono no las
 * tipa bien.
 *
 * Rutas: GET /v1/teacher/subjects, GET/POST /v1/subjects/:id/guides,
 * GET/PATCH/DELETE /v1/guides/:id y POST /v1/guides/:id/publish.
 * La sesión la vigila <StaffShell> (requireStaff("teacher")).
 */

import { getAccessToken } from "./supabase";
import { NoStaffSession } from "./admin";

/** El mensaje de la API (`{ error }`) o el status, para mostrarlo en el aviso. */
async function apiError(res: Response): Promise<Error> {
  let message = `La API respondió ${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    // Sin cuerpo JSON: se queda el mensaje genérico.
  }
  return new Error(message);
}

/** Devuelve el JSON de una respuesta 200, o lanza NoStaffSession / Error. */
async function ok<T>(res: Response): Promise<T> {
  if (res.status === 401 || res.status === 403) throw new NoStaffSession();
  if (!res.ok) throw await apiError(res);
  return (await res.json()) as T;
}

/** Cabeceras con Bearer token para llamadas a la API. */
async function authHeaders(): Promise<Headers> {
  const token = await getAccessToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

// ---------- Tipos del profesor ----------

export interface TeacherSubject {
  id: string;
  name: string;
  group: {
    id: string;
    label: string;
    shift: string;
    shiftLabel: string;
    accessCode: string;
  } | null;
  publishedGuides: number;
  draftGuides: number;
}

export interface TeacherRecentGuide {
  id: string;
  title: string;
  topic: string;
  status: "draft" | "published";
  updatedAt: string | null;
  subject: { id: string; name: string } | null;
  group: { id: string; label: string; shift: string; shiftLabel: string; accessCode: string } | null;
}

export interface TeacherOverview {
  subjects: TeacherSubject[];
  recentGuides: TeacherRecentGuide[];
}

export interface TeacherGuide {
  id: string;
  subjectId: string;
  topic: string;
  title: string;
  description: string;
  status: "draft" | "published";
  publishedAt: string | null;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  createdAt: string | undefined;
  updatedAt: string | undefined;
}

export interface TeacherGuidesPage {
  items: TeacherGuide[];
  summary: { total: number; published: number; drafts: number };
}

export interface TeacherGuideFormValues {
  topic: string;
  title: string;
  description: string;
  status: "draft" | "published";
}

export interface TeacherGuideFormErrors {
  topic?: string;
  title?: string;
  description?: string;
  status?: string;
}

// ---------- Llamadas a la API ----------

/** Mis materias con guías publicadas/borrador y guías recientes (profesor-01). */
export async function getTeacherOverview(): Promise<TeacherOverview> {
  const res = await fetch("/api/v1/teacher/subjects", {
    headers: await authHeaders(),
    credentials: "include",
  });
  return ok<TeacherOverview>(res);
}

/** Guías de una materia con resumen (profesor-02). */
export async function getSubjectGuides(subjectId: string): Promise<TeacherGuidesPage> {
  const res = await fetch(`/api/v1/subjects/${subjectId}/guides`, {
    headers: await authHeaders(),
    credentials: "include",
  });
  return ok<TeacherGuidesPage>(res);
}

/** Subir una guía (multipart con PDF) (profesor-03). */
export async function createGuide(subjectId: string, form: FormData): Promise<TeacherGuide> {
  const res = await fetch(`/api/v1/subjects/${subjectId}/guides`, {
    headers: await authHeaders(),
    credentials: "include",
    method: "POST",
    body: form,
  });
  return ok<TeacherGuide>(res);
}

/** Detalle de una guía (profesor-04). */
export async function getGuide(guideId: string): Promise<TeacherGuide> {
  const res = await fetch(`/api/v1/guides/${guideId}`, {
    headers: await authHeaders(),
    credentials: "include",
  });
  return ok<TeacherGuide>(res);
}

/** Editar título/tema/descripción de una guía (profesor-04). */
export async function updateGuide(
  guideId: string,
  input: { topic?: string; title?: string; description?: string },
): Promise<TeacherGuide> {
  const headers = await authHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`/api/v1/guides/${guideId}`, {
    headers,
    credentials: "include",
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return ok<TeacherGuide>(res);
}

/** Reemplazar el PDF de una guía (profesor-05). */
export async function replaceGuidePdf(guideId: string, form: FormData): Promise<TeacherGuide> {
  const res = await fetch(`/api/v1/guides/${guideId}`, {
    headers: await authHeaders(),
    credentials: "include",
    method: "PATCH",
    body: form,
  });
  return ok<TeacherGuide>(res);
}

/** Borrar una guía y su PDF (profesor-05). */
export async function deleteGuide(guideId: string): Promise<void> {
  const res = await fetch(`/api/v1/guides/${guideId}`, {
    headers: await authHeaders(),
    credentials: "include",
    method: "DELETE",
  });
  const status: number = res.status;
  if (status === 401 || status === 403) throw new NoStaffSession();
  if (status >= 400) throw await apiError(res);
}

/** Publicar un borrador (profesor-06). */
export async function publishGuide(guideId: string): Promise<TeacherGuide> {
  const res = await fetch(`/api/v1/guides/${guideId}/publish`, {
    headers: await authHeaders(),
    credentials: "include",
    method: "POST",
  });
  return ok<TeacherGuide>(res);
}

// ---------- Validación (mensajes en español) ----------

export function validateGuideForm(values: TeacherGuideFormValues): {
  errors: TeacherGuideFormErrors;
  input: TeacherGuideFormValues | null;
} {
  const errors: TeacherGuideFormErrors = {};
  const topic = values.topic.trim();
  const title = values.title.trim();
  const description = values.description.trim();

  if (!topic) errors.topic = "Escribe el tema de la guía.";
  else if (topic.length < 2) errors.topic = "El tema es muy corto.";
  else if (topic.length > 60) errors.topic = "El tema es demasiado largo (máx. 60 caracteres).";

  if (!title) errors.title = "Escribe el título de la guía.";
  else if (title.length < 2) errors.title = "El título es muy corto.";
  else if (title.length > 120) errors.title = "El título es demasiado largo (máx. 120 caracteres).";

  if (!description) errors.description = "Escribe una descripción.";
  else if (description.length < 2) errors.description = "La descripción es muy corta.";
  else if (description.length > 600) errors.description = "La descripción es demasiado larga (máx. 600 caracteres).";

  if (!values.status) errors.status = "Selecciona el estado.";

  if (errors.topic || errors.title || errors.description || errors.status)
    return { errors, input: null };

  return {
    errors,
    input: { topic, title, description, status: values.status },
  };
}

export function plural(n: number, uno: string, muchos: string): string {
  return `${n} ${n === 1 ? uno : muchos}`;
}
