import { Book, BookMarked, BookOpen, FlaskConical, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Icono de la tarjeta de materia. El Figma dibuja uno distinto por materia
 * (libro cerrado, libro abierto, matraz); mientras la API no trae un campo de
 * icono, se deduce del nombre.
 */
export function subjectIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (n.includes("ciencias") || n.includes("naturales")) return FlaskConical;
  if (n.includes("lengua") || n.includes("castellana")) return BookOpen;
  if (n.includes("matemátic") || n.includes("algebra")) return BookMarked;
  if (n.includes("estudio") || n.includes("taller")) return PenLine;
  return Book;
}
