/**
 * Capa de datos del área de profesores (WEB-06).
 *
 * Todas las llamadas pasan por el cliente tipado `api` (hc<AppType>, ADR 0002):
 * rutas y respuestas salen del tipo de Hono, no se escriben dos veces.
 *
 * Rutas usadas:
 *   GET /v1/teachers          - lista con búsqueda y paginación (admin-08)
 *   POST /v1/teachers         - registrar con contraseña temporal (admin-09)
 *   GET /v1/teachers/:id      - detalle con asignaciones (admin-09)
 *   PATCH /v1/teachers/:id    - editar nombre y usuario (admin-09)
 *   DELETE /v1/teachers/:id   - eliminar con confirmación (admin-10)
 *   POST /v1/teachers/:id/password - restablecer contraseña temporal (admin-09)
 *   PUT /v1/subjects/:id/teachers - asignar o quitar docente de una materia (admin-09)
 *
 * La sesión la vigila <StaffShell> (requireStaff("admin")).
 */

import { api } from "./api";
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

/** Las respuestas de la API son uniones por status; esto devuelve la del 200 o lanza. */
async function ok<T>(res: Response): Promise<T> {
  if (res.status === 401 || res.status === 403) throw new NoStaffSession();
  if (!res.ok) throw await apiError(res);
  return (await res.json()) as T;
}

// ---------- Tipos del front ----------

export interface TeacherGroupRef {
  id: string;
  /** «CLEI IV · A» */
  label: string;
  shift: string;
  /** «Mañana» */
  shiftLabel: string;
  /** «CENSA-4AM-K7Q» */
  accessCode: string;
}

export interface TeacherAssignment {
  id: string;
  subject: { id: string; name: string };
  group: TeacherGroupRef;
}

export interface AdminTeacher {
  id: string;
  /** «Laura Martínez» */
  fullName: string;
  /** Usuario institucional, en minúsculas: «laura.martinez» */
  username: string;
  active: boolean;
  assignments: TeacherAssignment[];
}

export interface TeacherListPage {
  items: AdminTeacher[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TeacherFormValues {
  fullName: string;
  username: string;
  /** Solo en el alta: en el detalle nunca se vuelve a ver la contraseña. */
  temporaryPassword: string;
}

export interface TeacherFormErrors {
  fullName?: string;
  username?: string;
  temporaryPassword?: string;
}

export interface TeacherInput {
  fullName: string;
  username: string;
  temporaryPassword: string;
}

/** Materia de un grupo a la que se puede asignar un docente (admin-09). */
export interface SubjectSlot {
  id: string;
  groupId: string;
  /** «Matemáticas» */
  name: string;
  /** «CLEI IV · A · Mañana»: lo que se lee en el selector. */
  label: string;
}

// ---------- Textos compartidos ----------

/** «Laura»: el Figma titula «Asignaciones de Laura» con el nombre de pila. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Une con «y» al final («A y B», «A, B y C»), como los textos del Figma. */
function joinY(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Materias distintas del docente, en el orden de sus asignaciones. */
export function teacherSubjects(teacher: AdminTeacher): string[] {
  const names: string[] = [];
  for (const assignment of teacher.assignments) {
    if (!names.includes(assignment.subject.name)) names.push(assignment.subject.name);
  }
  return names;
}

/** Grupos distintos del docente (varias materias del mismo grupo se juntan). */
export function teacherGroups(teacher: AdminTeacher): TeacherGroupRef[] {
  const groups: TeacherGroupRef[] = [];
  for (const assignment of teacher.assignments) {
    if (!groups.some((group) => group.id === assignment.group.id)) groups.push(assignment.group);
  }
  return groups;
}

/** «CLEI IV · A / Mañana»: la celda «Grupos asignados» de admin-08. */
export function groupLines(teacher: AdminTeacher): string[] {
  return teacherGroups(teacher).map((group) => `${group.label} / ${group.shiftLabel}`);
}

/** «sus 2 asignaciones de Matemáticas en CLEI IV · A y CLEI V · B» (admin-10). */
export function deleteDescription(teacher: AdminTeacher): string {
  const n = teacher.assignments.length;
  if (n === 0) return "Se eliminará su usuario. No tiene asignaciones de materias.";
  const subjects = joinY(teacherSubjects(teacher));
  const groups = joinY(teacherGroups(teacher).map((group) => group.label));
  const numero = n === 1 ? "su asignación" : `sus ${n} asignaciones`;
  return `Se eliminará su usuario y ${numero} de ${subjects} en ${groups}.`;
}

/** «2 asignaciones. Laura solo puede gestionar guías de Matemáticas en CLEI IV · A y CLEI V · B.» */
export function assignmentsSummary(teacher: AdminTeacher): string {
  const n = teacher.assignments.length;
  if (n === 0) return "Sin asignaciones todavía. Añade una materia para que este docente gestione guías.";
  const numero = n === 1 ? "1 asignación" : `${n} asignaciones`;
  const subjects = joinY(teacherSubjects(teacher));
  const grupos = teacherGroups(teacher).map((group) => group.label);
  const alcance = grupos.length === 1 ? `en ${grupos[0]}` : `en ${joinY(grupos)}`;
  return `${numero}. ${firstName(teacher.fullName)} solo puede gestionar guías de ${subjects} ${alcance}.`;
}

// ---------- Validación (mensajes en español, como validateGroupForm) ----------

/** Valida el alta de un profesor (admin-09 / `createTeacherInput` de shared). */
export function validateTeacherForm(values: TeacherFormValues): {
  errors: TeacherFormErrors;
  input: TeacherInput | null;
} {
  const errors: TeacherFormErrors = {};
  const fullName = values.fullName.trim();
  const username = values.username.trim().toLowerCase();
  const temporaryPassword = values.temporaryPassword;

  if (!fullName) errors.fullName = "Escribe el nombre completo.";
  else if (fullName.length < 3) errors.fullName = "Usa al menos 3 caracteres.";

  if (!username) errors.username = "Escribe el usuario institucional.";
  else if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    errors.username = "Usa de 3 a 40 caracteres: minúsculas, números, puntos o guiones.";
  }

  if (!temporaryPassword) errors.temporaryPassword = "Escribe la contraseña temporal.";
  else if (temporaryPassword.length < 8) errors.temporaryPassword = "Usa al menos 8 caracteres.";
  else if (temporaryPassword.length > 72) errors.temporaryPassword = "Usa 72 caracteres como máximo.";

  if (errors.fullName || errors.username || errors.temporaryPassword) return { errors, input: null };
  return { errors, input: { fullName, username, temporaryPassword } };
}

/** Valida los datos del docente en el detalle (sin contraseña: no se toca aquí). */
export function validateProfileForm(values: { fullName: string; username: string }): {
  errors: TeacherFormErrors;
  input: { fullName: string; username: string } | null;
} {
  const errors: TeacherFormErrors = {};
  const fullName = values.fullName.trim();
  const username = values.username.trim().toLowerCase();

  if (!fullName) errors.fullName = "Escribe el nombre completo.";
  else if (fullName.length < 3) errors.fullName = "Usa al menos 3 caracteres.";

  if (!username) errors.username = "Escribe el usuario institucional.";
  else if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    errors.username = "Usa de 3 a 40 caracteres: minúsculas, números, puntos o guiones.";
  }

  if (errors.fullName || errors.username) return { errors, input: null };
  return { errors, input: { fullName, username } };
}

// ---------- Llamadas a la API ----------

/** La lista de admin-08 cabe en una página; el total se devuelve siempre. */
export const TEACHERS_PAGE_SIZE = 12;

/** Lista de admin-08: busca por nombre o usuario y pagina. */
export async function listTeachers(filters: { q?: string; page?: number } = {}): Promise<TeacherListPage> {
  const res = await api.v1.teachers.$get({ query: { q: filters.q ?? undefined, page: String(filters.page ?? 1) } });
  const data = await ok<{
    items: { id: string; username: string; fullName: string; active: boolean; subjects: string[]; groups: string[] }[];
    total: number;
    activeCount: number;
    page: number;
    pageSize: number;
  }>(res);
  // La API devuelve subjects y groups como strings; las asignaciones detalladas se cargan en el detalle.
  return {
    items: data.items.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      username: t.username,
      active: t.active,
      assignments: [], // Se cargan en el detalle (admin-09)
    })),
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  };
}

/** Trae un profesor por id (para el detalle). Devuelve null si no existe. */
export async function getTeacher(id: string): Promise<AdminTeacher | null> {
  const res = await api.v1.teachers[":id"].$get({ param: { id } });
  if (res.status === 404) return null;
  const data = await ok<{
    id: string;
    username: string;
    fullName: string;
    active: boolean;
    assignments: { subject: { id: string; name: string }; group: { id: string; label: string; shift: string; shiftLabel: string; accessCode: string } }[];
  }>(res);
  return {
    id: data.id,
    fullName: data.fullName,
    username: data.username,
    active: data.active,
    assignments: data.assignments.map((a) => ({
      id: `asig-${a.subject.id}-${a.group.id}`,
      subject: { id: a.subject.id, name: a.subject.name },
      group: {
        id: a.group.id,
        label: a.group.label,
        shift: a.group.shift,
        shiftLabel: a.group.shiftLabel,
        accessCode: a.group.accessCode,
      },
    })),
  };
}

/** Registra al profesor: usuario institucional + contraseña temporal. */
export async function createTeacher(input: TeacherInput): Promise<AdminTeacher> {
  const res = await api.v1.teachers.$post({
    json: { fullName: input.fullName, username: input.username, temporaryPassword: input.temporaryPassword },
  });
  const data = await ok<{ id: string; username: string; fullName: string; active: boolean }>(res);
  return { id: data.id, fullName: data.fullName, username: data.username, active: data.active, assignments: [] };
}

/** Guarda nombre y usuario desde el detalle. */
export async function updateTeacher(
  id: string,
  input: { fullName: string; username: string },
): Promise<AdminTeacher> {
  const res = await api.v1.teachers[":id"].$patch({ param: { id }, json: { fullName: input.fullName, username: input.username } });
  const data = await ok<{ id: string; username: string; fullName: string; active: boolean }>(res);
  return { id: data.id, fullName: data.fullName, username: data.username, active: data.active, assignments: [] };
}

/** Elimina al profesor. Sus materias quedan sin docente (la API pone teacher_id en null). */
export async function deleteTeacher(id: string): Promise<void> {
  const res = await api.v1.teachers[":id"].$delete({ param: { id } });
  const status: number = res.status;
  if (status === 401 || status === 403) throw new NoStaffSession();
  if (status >= 400) throw await apiError(res);
}

/** Contraseña temporal nueva (POST /v1/teachers/:id/password): el front genera
 *  la contraseña y la envía; la API solo la aplica. Solo se enseña una vez. */
export async function resetTeacherPassword(id: string): Promise<string> {
  const password = randomTemporaryPassword();
  const res = await api.v1.teachers[":id"].password.$post({ param: { id }, json: { password } });
  await ok(res);
  return password;
}

// ---------- Asignaciones de materias ----------

/** Materias a las que se puede asignar al docente (admin-09). */
export async function availableSlots(teacherId: string): Promise<SubjectSlot[]> {
  const res = await api.v1.subjects.$get({ query: {} });
  const data = await ok<{ items: { id: string; name: string; group_id: string; teacher_id: string | null }[] }>(res);
  const teacher = await getTeacher(teacherId);
  const mias = new Set(teacher?.assignments.map((assignment) => assignment.subject.id) ?? []);
  return data.items
    .filter((slot) => !mias.has(slot.id) && slot.teacher_id === null)
    .map((slot) => ({
      id: slot.id,
      groupId: slot.group_id,
      name: slot.name,
      label: slot.name,
    }));
}

/** Asigna la materia al docente (PUT /v1/subjects/:id/teachers). */
export async function assignSlot(teacherId: string, slotId: string): Promise<AdminTeacher> {
  const res = await api.v1.subjects[":id"].teachers.$put({ param: { id: slotId }, json: { teacherId } });
  const data = await ok<{ id: string; fullName: string; username: string; active: boolean; assignments: TeacherAssignment[] }>(res);
  return {
    id: data.id,
    fullName: data.fullName,
    username: data.username,
    active: data.active,
    assignments: data.assignments,
  };
}

/** Quita la asignación al docente: la materia queda sin docente. */
export async function unassign(teacherId: string, assignmentId: string): Promise<AdminTeacher> {
  const teacher = await getTeacher(teacherId);
  const assignment = teacher?.assignments.find((a) => a.id === assignmentId);
  if (!assignment) throw new Error("No encontramos la asignación.");
  await api.v1.subjects[":id"].teachers.$put({ param: { id: assignment.subject.id }, json: { teacherId: null } });
  const actualizado = await getTeacher(teacherId);
  if (!actualizado) throw new Error("No encontramos al profesor.");
  return actualizado;
}

/** Contraseña temporal de 12 caracteres sin ambiguos (no se usa: la API la genera). */
export function randomTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
