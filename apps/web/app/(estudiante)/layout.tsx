import { StudentShell } from "./student-shell";

/** Envoltorio de todas las pantallas del estudiante: barra lateral (escritorio), barra superior y navegación inferior (móvil). */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}
