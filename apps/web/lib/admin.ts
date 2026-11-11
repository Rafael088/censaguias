/**
 * Capa de datos del área de administración (WEB-04).
 *
 * Todo pasa por el cliente tipado `api` (hc<AppType>, ADR 0002): rutas y
 * respuestas salen del tipo de Hono y no se escriben dos veces. La API ya
 * existe (API-02), así que aquí no hay datos de muestra.
 */

import { SHIFT_LABEL, type Shift } from "@censaguias/shared";
import { api } from "./api";

/** Grupo de GET /v1/groups y GET /v1/groups/:id (mapGroup de la API). */
export interface AdminGroup {
  id: string;
  clei: number;
  identifier: string;
  /** «CLEI IV · A» */
  label: string;
  shift: Shift;
  /** «Mañana» */
  shiftLabel: string;
  schoolYear: number;
  /** «CENSA-4AM-K7Q» */
  accessCode: string;
  codeVersion: number;
  /** En la lista es el número de materias; en el detalle, la lista de materias. */
  subjects: unknown;
}

export interface GroupListPage {
  items: AdminGroup[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * `subjects` es un número en la lista y la lista de materias en el detalle;
 * aquí se cuenta lo que toque para los rótulos («3 materias») y para avisos.
 */
export function subjectsCount(group: AdminGroup): number {
  if (typeof group.subjects === "number") return group.subjects;
  return Array.isArray(group.subjects) ? group.subjects.length : 0;
}

/** Año lectivo de los grupos nuevos: es el que asume el Figma («Año lectivo 2026»). */
export const CURRENT_SCHOOL_YEAR = 2026;

export interface GroupFormValues {
  /** Valor del selector, como texto («4») o vacío. */
  clei: string;
  identifier: string;
  shift: string;
}

export interface GroupFormErrors {
  clei?: string;
  identifier?: string;
  shift?: string;
}

/**
 * Valida el formulario de crear/editar grupo con mensajes en español.
 * Devuelve los errores para cada campo o, si no hay, la lista limpia para la API.
 */
export function validateGroupForm(values: GroupFormValues): {
  errors: GroupFormErrors;
  input: { clei: number; identifier: string; shift: Shift } | null;
} {
  const errors: GroupFormErrors = {};
  const identifier = values.identifier.trim().toUpperCase();

  if (!/^[1-6]$/.test(values.clei)) errors.clei = "Selecciona un CLEI.";
  if (!identifier) errors.identifier = "Escribe el identificador del grupo.";
  else if (!/^[A-Z]$/.test(identifier)) errors.identifier = "Usa una sola letra, de A a Z.";
  if (!(values.shift in SHIFT_LABEL)) errors.shift = "Selecciona una jornada.";

  if (errors.clei || errors.identifier || errors.shift) return { errors, input: null };
  return {
    errors,
    input: { clei: Number(values.clei), identifier, shift: values.shift as Shift },
  };
}

/** 401: no hay sesión de admin (o el token venció). La pantalla vuelve al acceso. */
export class NoStaffSession extends Error {
  constructor() {
    super("Sin sesión de administración");
    this.name = "NoStaffSession";
  }
}

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

/** Las respuestas de la API son uniones por status; esto devuelve la del 200 o lanza. */
async function ok<T>(res: Response): Promise<T> {
  if (res.status === 401 || res.status === 403) throw new NoStaffSession();
  if (!res.ok) throw await apiError(res);
  return (await res.json()) as T;
}

/** Resumen de admin-01: las cuatro métricas, la distribución por jornada y los grupos recientes. */
export interface AdminSummary {
  groups: number;
  activeTeachers: number;
  assignedTeachers: number;
  subjects: number;
  publishedGuides: number;
  shifts: { shift: Shift; label: string; groups: number; percent: number }[];
  recentGroups: AdminGroup[];
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const res = await api.v1.admin.summary.$get();
  return ok<AdminSummary>(res);
}

export interface GroupFilters {
  /** Texto del buscador (CLEI, identificador o código). */
  q?: string;
  /** Jornada elegida en las pestañas; vacío = todas. */
  shift?: Shift | "";
  page?: number;
}

/** Lista de admin-02 con búsqueda, filtro de jornada y paginación. */
export async function listGroups(filters: GroupFilters = {}): Promise<GroupListPage> {
  // El query del cliente tipado va como texto (coerido por groupListQuery en la API).
  const query: { q?: string; shift?: Shift; page?: string } = {};
  if (filters.q) query.q = filters.q;
  if (filters.shift) query.shift = filters.shift;
  if (filters.page) query.page = String(filters.page);

  const res = await api.v1.groups.$get({ query });
  return ok<GroupListPage>(res);
}

export interface GroupInput {
  clei: number;
  /** Una letra, en mayúsculas. */
  identifier: string;
  shift: Shift;
  schoolYear: number;
}

/** Crea el grupo y devuelve el generado, con su código de acceso. */
export async function createGroup(input: GroupInput): Promise<AdminGroup> {
  const res = await api.v1.groups.$post({ json: input });
  return ok<AdminGroup>(res);
}

/** Trae un grupo por id (para editar). Devuelve null si no existe. */
export async function getGroup(id: string): Promise<AdminGroup | null> {
  const res = await api.v1.groups[":id"].$get({ param: { id } });
  if (res.status === 404) return null;
  return ok<AdminGroup>(res);
}

/** Guarda los cambios del formulario de editar. */
export async function updateGroup(id: string, input: Partial<GroupInput>): Promise<AdminGroup> {
  const res = await api.v1.groups[":id"].$patch({ param: { id }, json: input });
  return ok<AdminGroup>(res);
}

/**
 * Regenera el código de acceso: sube `code_version` e invalida las cookies
 * de estudiante anteriores. Devuelve el código nuevo.
 */
export async function regenerateGroupCode(id: string): Promise<{ accessCode: string; codeVersion: number }> {
  const res = await api.v1.groups[":id"].code.$post({ param: { id } });
  return ok<{ accessCode: string; codeVersion: number }>(res);
}

/** Elimina el grupo (con sus materias, guías y PDFs). */
export async function deleteGroup(id: string): Promise<void> {
  const res = await api.v1.groups[":id"].$delete({ param: { id } });
  // Hono solo tipa el 204 de esta ruta; en runtime puede llegar el 401/403 de requireStaff.
  const status: number = res.status;
  if (status === 401 || status === 403) throw new NoStaffSession();
  if (status >= 400) throw await apiError(res);
}

// ---------- Materias de un grupo (WEB-05) ----------

export interface SubjectDetail {
  id: string;
  name: string;
  description: string | null;
  teacher: { id: string; fullName: string } | null;
  publishedGuides: number;
}

export interface TeacherOption {
  id: string;
  fullName: string;
}

export interface SubjectFormValues {
  name: string;
  description: string;
  teacherId: string;
}

export interface SubjectFormErrors {
  name?: string;
  teacherId?: string;
}

export function validateSubjectForm(values: SubjectFormValues, teachers: TeacherOption[]): {
  errors: SubjectFormErrors;
  input: { name: string; description: string | null; teacherId: string } | null;
} {
  const errors: SubjectFormErrors = {};
  const name = values.name.trim();
  const description = values.description.trim() || null;
  const teacherId = values.teacherId || null;

  if (!name) errors.name = "Escribe el nombre de la materia.";
  else if (name.length < 2) errors.name = "El nombre es muy corto.";
  else if (name.length > 80) errors.name = "El nombre es demasiado largo (máx. 80 caracteres).";

  if (!teacherId) errors.teacherId = "Selecciona un docente.";
  else if (!teachers.some((t) => t.id === teacherId)) errors.teacherId = "Ese docente no existe.";

  if (errors.name || errors.teacherId) return { errors, input: null };
  return { errors, input: { name, description, teacherId: teacherId! } };
}

/** Lista las materias de un grupo con su docente y guías publicadas (admin-05). */
export async function listSubjects(groupId: string): Promise<SubjectDetail[]> {
  const res = await api.v1.groups[":id"].subjects.$get({ param: { id: groupId } });
  return ok<SubjectDetail[]>(res);
}

/** Crea una materia en el grupo (admin-06). */
export async function createSubject(groupId: string, input: { name: string; description: string | null; teacherId: string }): Promise<SubjectDetail> {
  const res = await api.v1.groups[":id"].subjects.$post({
    param: { id: groupId },
    json: { name: input.name, description: input.description ?? undefined, teacherId: input.teacherId },
  });
  return ok<SubjectDetail>(res);
}

/** Edita el nombre y/o la descripción de una materia (admin-07). */
export async function updateSubject(subjectId: string, input: { name?: string; description?: string | null }): Promise<SubjectDetail> {
  const res = await api.v1.subjects[":id"].$patch({ param: { id: subjectId }, json: input });
  return ok<SubjectDetail>(res);
}

/** Asigna o cambia el docente de una materia; null la deja sin docente (admin-07). */
export async function assignSubjectTeacher(subjectId: string, teacherId: string | null): Promise<SubjectDetail> {
  const res = await api.v1.subjects[":id"].teachers.$put({ param: { id: subjectId }, json: { teacherId } });
  return ok<SubjectDetail>(res);
}

/** Elimina una materia (admin-07). */
export async function deleteSubject(subjectId: string): Promise<void> {
  const res = await api.v1.subjects[":id"].$delete({ param: { id: subjectId } });
  const status: number = res.status;
  if (status === 401 || status === 403) throw new NoStaffSession();
  if (status >= 400) throw await apiError(res);
}

/** Lista los profesores para asignar a una materia. */
export async function listTeachers(): Promise<TeacherOption[]> {
  const res = await api.v1.teachers.$get({ query: {} });
  const data = (await res.json()) as { items: { id: string; fullName: string }[]; total: number };
  return data.items.map((t) => ({ id: t.id, fullName: t.fullName }));
}
