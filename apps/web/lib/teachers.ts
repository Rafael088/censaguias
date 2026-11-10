/**
 * Capa de datos del área de profesores (WEB-06).
 *
 * TODO(API-08): la API todavía no expone `/v1/teachers` (lista con `q` y
 * página, `POST` para registrar, `GET/PATCH/DELETE /:id` y `POST /:id/password`).
 * Mientras tanto, estas funciones sirven los datos de muestra del Figma
 * (`teachers-demo.ts`), igual que hace `student.ts` con API-07.
 *
 * Al entrar API-08: borra `teachers-demo.ts` y sustituye el cuerpo de cada
 * función por `hc<AppType>()` (ADR 0002). Las páginas no cambian: solo llaman
 * aquí. La sesión no se comprueba en este archivo: ya la vigila `<StaffShell>`
 * con `GET /v1/me`, que manda a `/ingresar` si no la hay.
 */

import { SHIFT_LABEL, type Shift } from "@censaguias/shared";
import { DEMO_GROUPS, DEMO_SLOTS, readTeachers, writeTeachers } from "./teachers-demo";

/** La lista de admin-08 cabe en una página; el total se devuelve siempre. */
export const TEACHERS_PAGE_SIZE = 12;

export interface TeacherGroupRef {
  id: string;
  /** «CLEI IV · A» */
  label: string;
  shift: Shift;
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
  return teacherGroups(teacher).map((group) => `${group.label} / ${SHIFT_LABEL[group.shift]}`);
}

/**
 * «sus 2 asignaciones de Matemáticas en CLEI IV · A y CLEI V · B» (admin-10).
 * El número, las materias y los grupos salen de los datos, no están escritos a mano.
 */
export function deleteDescription(teacher: AdminTeacher): string {
  const n = teacher.assignments.length;
  if (n === 0) return "Se eliminará su usuario. No tiene asignaciones de materias.";
  const subjects = joinY(teacherSubjects(teacher));
  const groups = joinY(teacherGroups(teacher).map((group) => group.label));
  const numero = n === 1 ? "su asignación" : `sus ${n} asignaciones`;
  return `Se eliminará su usuario y ${numero} de ${subjects} en ${groups}.`;
}

/**
 * «2 asignaciones. Laura solo puede gestionar guías de Matemáticas en CLEI IV · A
 * y CLEI V · B.» (pie de la tabla de admin-09).
 */
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

// ---------- Llamadas (hoy: almacén de muestra; con API-08: hc<AppType>()) ----------

/** Lista de admin-08: busca por nombre o usuario y pagina en el cliente. */
export async function listTeachers(filters: { q?: string; page?: number } = {}): Promise<TeacherListPage> {
  const query = (filters.q ?? "").trim().toLowerCase();
  const todos = readTeachers();
  const filtrados = query
    ? todos.filter(
        (teacher) =>
          teacher.fullName.toLowerCase().includes(query) || teacher.username.toLowerCase().includes(query),
      )
    : todos;

  const pageSize = TEACHERS_PAGE_SIZE;
  const total = filtrados.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pages);
  const desde = (page - 1) * pageSize;

  return { items: filtrados.slice(desde, desde + pageSize), total, page, pageSize };
}

/** Trae un profesor por id (para el detalle). Devuelve null si no existe. */
export async function getTeacher(id: string): Promise<AdminTeacher | null> {
  return readTeachers().find((teacher) => teacher.id === id) ?? null;
}

/**
 * Registra al profesor: usuario institucional + contraseña temporal.
 * El usuario es único (la API respondería 409 con el mismo mensaje).
 */
export async function createTeacher(input: TeacherInput): Promise<AdminTeacher> {
  const username = input.username.trim().toLowerCase();
  if (readTeachers().some((teacher) => teacher.username === username)) {
    throw new Error("Ese usuario institucional ya está registrado. Elige otro.");
  }

  const teacher: AdminTeacher = {
    id: username,
    fullName: input.fullName.trim(),
    username,
    active: true,
    assignments: [],
  };
  writeTeachers([...readTeachers(), teacher]);
  return teacher;
}

/** Guarda nombre y usuario desde el detalle. */
export async function updateTeacher(
  id: string,
  input: { fullName: string; username: string },
): Promise<AdminTeacher> {
  const todos = readTeachers();
  const actual = todos.find((teacher) => teacher.id === id);
  if (!actual) throw new Error("No encontramos al profesor.");

  const username = input.username.trim().toLowerCase();
  if (todos.some((teacher) => teacher.id !== id && teacher.username === username)) {
    throw new Error("Ese usuario institucional ya está registrado. Elige otro.");
  }

  const actualizado: AdminTeacher = { ...actual, fullName: input.fullName.trim(), username };
  writeTeachers(todos.map((teacher) => (teacher.id === id ? actualizado : teacher)));
  return actualizado;
}

/** Elimina al profesor. Sus materias quedan sin docente (la API pone teacher_id en null). */
export async function deleteTeacher(id: string): Promise<void> {
  writeTeachers(readTeachers().filter((teacher) => teacher.id !== id));
}

/** Contraseña temporal nueva (POST /v1/teachers/:id/password): solo se enseña una vez. */
export async function resetTeacherPassword(id: string): Promise<string> {
  if (!readTeachers().some((teacher) => teacher.id === id)) throw new Error("No encontramos al profesor.");
  return randomTemporaryPassword();
}

/**
 * Materias a las que se puede asignar al docente, con su etiqueta para el
 * selector. Si otra persona la tiene, al asignarla se reasigna (PUT /v1/subjects/:id/teachers).
 */
export async function availableSlots(teacherId: string): Promise<SubjectSlot[]> {
  const teacher = readTeachers().find((t) => t.id === teacherId);
  const mias = new Set(teacher?.assignments.map((assignment) => assignment.subject.id) ?? []);
  return DEMO_SLOTS.filter((slot) => !mias.has(slot.id)).map((slot) => {
    const group = DEMO_GROUPS.find(({ id }) => id === slot.groupId);
    return {
      id: slot.id,
      groupId: slot.groupId,
      name: slot.name,
      label: group ? `${group.label} · ${SHIFT_LABEL[group.shift]} — ${slot.name}` : slot.name,
    };
  });
}

/** Asigna la materia al docente (la añade o se la quita a quien la tenía). */
export async function assignSlot(teacherId: string, slotId: string): Promise<AdminTeacher> {
  const slot = DEMO_SLOTS.find(({ id }) => id === slotId);
  const group = DEMO_GROUPS.find(({ id }) => id === slot?.groupId);
  if (!slot || !group) throw new Error("Esa materia ya no existe.");

  const todos = readTeachers();
  const actual = todos.find((teacher) => teacher.id === teacherId);
  if (!actual) throw new Error("No encontramos al profesor.");
  if (actual.assignments.some((assignment) => assignment.subject.id === slotId)) return actual;

  const nueva: TeacherAssignment = {
    id: `asig-${teacherId}-${slotId}`,
    subject: { id: slot.id, name: slot.name },
    group: { id: group.id, label: group.label, shift: group.shift, accessCode: group.accessCode },
  };

  const siguiente = todos.map((teacher) => {
    if (teacher.id === teacherId) return { ...teacher, assignments: [...teacher.assignments, nueva] };
    // Una materia tiene un solo docente: si otro la tenía, queda sin ella.
    return { ...teacher, assignments: teacher.assignments.filter((a) => a.subject.id !== slotId) };
  });
  writeTeachers(siguiente);
  return siguiente.find((teacher) => teacher.id === teacherId) ?? actual;
}

/** Quita la asignación al docente: la materia queda sin docente. */
export async function unassign(teacherId: string, assignmentId: string): Promise<AdminTeacher> {
  const todos = readTeachers();
  const actual = todos.find((teacher) => teacher.id === teacherId);
  if (!actual) throw new Error("No encontramos al profesor.");

  const siguiente = todos.map((teacher) =>
    teacher.id === teacherId
      ? { ...teacher, assignments: teacher.assignments.filter((a) => a.id !== assignmentId) }
      : teacher,
  );
  writeTeachers(siguiente);
  return siguiente.find((teacher) => teacher.id === teacherId) ?? actual;
}

/**
 * Contraseña temporal de 12 caracteres sin ambiguos (ni I/l/1 ni O/0), como el
 * código de acceso del ADR 0004. Solo se genera: no se guarda ni se vuelve a mostrar.
 */
function randomTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
