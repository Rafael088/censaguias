import type { Shift } from "@censaguias/shared";
import type { AdminTeacher, TeacherAssignment } from "./teachers";

/**
 * Datos de muestra del Figma (`docs/diseno/admin-08…10`), mientras API-08 no
 * expone las rutas de profesor. Se borra con la capa real.
 *
 * Los códigos de grupo cumplen `ACCESS_CODE_REGEX` (ADR 0004): los que dibuja
 * el Figma («CENSA-4AM-26») no llevan sufijo de tres caracteres y la API los
 * rechazaría, igual que pasó con `student-demo.ts`.
 *
 * El almacén es un array vivo en módulo: cada pantalla lee con `readTeachers()`
 * y escribe con `writeTeachers(...)`, que siempre guarda un array nuevo. Así
 * un registro o un borrado se ven en todas las pantallas de la misma sesión.
 */

export interface DemoGroup {
  id: string;
  /** «CLEI IV · A» */
  label: string;
  shift: Shift;
  /** «CENSA-4AM-K7Q» */
  accessCode: string;
}

/** Materia de un grupo concreto: es lo que se asigna a un docente. */
export interface DemoSlot {
  id: string;
  groupId: string;
  /** «Matemáticas» */
  name: string;
}

export const DEMO_GROUPS: DemoGroup[] = [
  { id: "clei-4a", label: "CLEI IV · A", shift: "morning", accessCode: "CENSA-4AM-K7Q" },
  { id: "clei-5b", label: "CLEI V · B", shift: "night", accessCode: "CENSA-5BN-7KP" },
  { id: "clei-5a", label: "CLEI V · A", shift: "night", accessCode: "CENSA-5AN-R8P" },
  { id: "clei-6a", label: "CLEI VI · A", shift: "morning", accessCode: "CENSA-6AM-M4T" },
];

export const DEMO_SLOTS: DemoSlot[] = [
  { id: "matematicas-4a", groupId: "clei-4a", name: "Matemáticas" },
  { id: "lengua-4a", groupId: "clei-4a", name: "Lengua Castellana" },
  { id: "ciencias-4a", groupId: "clei-4a", name: "Ciencias Naturales" },
  { id: "matematicas-5b", groupId: "clei-5b", name: "Matemáticas" },
  { id: "lengua-5b", groupId: "clei-5b", name: "Lengua Castellana" },
  { id: "lengua-5a", groupId: "clei-5a", name: "Lengua Castellana" },
  { id: "ciencias-5a", groupId: "clei-5a", name: "Ciencias Naturales" },
  { id: "matematicas-6a", groupId: "clei-6a", name: "Matemáticas" },
  { id: "ciencias-6a", groupId: "clei-6a", name: "Ciencias Naturales" },
];

/** Asignación armada a partir de una materia: grupo y docente en la misma pieza. */
function asignada(slotId: string, assignmentId: string): TeacherAssignment {
  const slot = DEMO_SLOTS.find(({ id }) => id === slotId);
  const group = DEMO_GROUPS.find(({ id }) => id === slot?.groupId);
  if (!slot || !group) throw new Error(`Materia de prueba desconocida: ${slotId}`);
  return {
    id: assignmentId,
    subject: { id: slot.id, name: slot.name },
    group: { id: group.id, label: group.label, shift: group.shift, accessCode: group.accessCode },
  };
}

/** Docentes del Figma `admin-08`: mismos nombres, usuarios y asignaciones. */
const SEMILLA: AdminTeacher[] = [
  {
    id: "laura-martinez",
    fullName: "Laura Martínez",
    username: "laura.martinez",
    active: true,
    assignments: [asignada("matematicas-4a", "asig-laura-4a"), asignada("matematicas-5b", "asig-laura-5b")],
  },
  {
    id: "carlos-ramirez",
    fullName: "Carlos Ramírez",
    username: "carlos.ramirez",
    active: true,
    assignments: [asignada("lengua-4a", "asig-carlos-4a"), asignada("lengua-5a", "asig-carlos-5a")],
  },
  {
    id: "ana-torres",
    fullName: "Ana Torres",
    username: "ana.torres",
    active: true,
    assignments: [asignada("ciencias-4a", "asig-ana-4a"), asignada("matematicas-6a", "asig-ana-6a")],
  },
];

let store: AdminTeacher[] = SEMILLA;

/** Copia de los docentes: nadie toca en sitio los objetos del almacén. */
export function readTeachers(): AdminTeacher[] {
  return store.map((teacher) => ({
    ...teacher,
    assignments: teacher.assignments.map((assignment) => ({
      ...assignment,
      subject: { ...assignment.subject },
      group: { ...assignment.group },
    })),
  }));
}

/** Guarda la lista completa (array nuevo); es la única forma de escribir. */
export function writeTeachers(next: AdminTeacher[]): void {
  store = next;
}
