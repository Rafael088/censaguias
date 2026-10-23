import type { StudentGuide, StudentGroup, StudentSubject } from "./student";

/**
 * Datos de muestra del Figma (`docs/diseno/estudiante-*.png`), mientras API-07
 * no expone las rutas de estudiante. Se borra con la capa real.
 *
 * El código del grupo es `CENSA-4AM-K7Q` (el del ADR 0004): el que dibuja el
 * Figma, «CENSA-4AM-26», no cumple el patrón del esquema y el API lo rechazaría.
 */

export const DEMO_GROUP: StudentGroup = {
  label: "CLEI IV · A",
  shift: "Mañana",
  schoolYear: 2026,
  code: "CENSA-4AM-K7Q",
};

export const DEMO_SUBJECTS: StudentSubject[] = [
  {
    id: "matematicas",
    name: "Matemáticas",
    description: "Álgebra y operaciones",
    teacher: "Laura Martínez",
    guideCount: 2,
  },
  {
    id: "lengua-castellana",
    name: "Lengua Castellana",
    description: "Lectura y escritura",
    teacher: "Carlos Ramírez",
    guideCount: 1,
  },
  {
    id: "ciencias-naturales",
    name: "Ciencias Naturales",
    description: "Ciencia y entorno",
    teacher: "Ana Torres",
    guideCount: 0,
  },
];

export const DEMO_GUIDES: StudentGuide[] = [
  {
    id: "ecuaciones-primer-grado",
    topic: "Álgebra",
    title: "Ecuaciones de primer grado",
    description:
      "Aprende a despejar la incógnita y a comprobar tus resultados con ejemplos y ejercicios. Lee la guía y resuelve las actividades propuestas.\n\nObjetivo: resolver ecuaciones de primer grado aplicando operaciones equivalentes en ambos lados de la igualdad.",
    publishedAt: "2026-10-14",
    fileName: "ecuaciones_primer_grado.pdf",
    sizeBytes: 1_887_437,
    pageCount: 4,
    subject: { id: "matematicas", name: "Matemáticas" },
    teacher: "Laura Martínez",
  },
  {
    id: "operaciones-numeros-enteros",
    topic: "Aritmética",
    title: "Operaciones con números enteros",
    description: "Repasa las operaciones y resuelve ejercicios paso a paso.",
    publishedAt: "2026-10-12",
    fileName: "operaciones_con_numeros_enteros.pdf",
    sizeBytes: 1_258_291,
    pageCount: 2,
    subject: { id: "matematicas", name: "Matemáticas" },
    teacher: "Laura Martínez",
  },
  {
    id: "comprension-de-textos",
    topic: "Lectura",
    title: "Comprensión de textos",
    description:
      "Lee el texto propuesto y resuelve las actividades: idea principal, vocabulario e inferencias.",
    publishedAt: "2026-10-13",
    fileName: "comprension_de_textos.pdf",
    sizeBytes: 1_468_006,
    pageCount: 2,
    subject: { id: "lengua-castellana", name: "Lengua Castellana" },
    teacher: "Carlos Ramírez",
  },
];
