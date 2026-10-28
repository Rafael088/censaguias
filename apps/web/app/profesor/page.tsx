"use client";

import { useStaffProfile } from "@/components/staff-shell";

// Inicio del área docente (Figma `profesor-01-mis-grupos`: «Hola, Laura» con sus grupos).
// La lista de grupos y materias es WEB-07.
export default function ProfesorInicio() {
  const me = useStaffProfile();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
      <h1 className="text-section font-semibold text-ink">Hola, {me.fullName.split(" ")[0]}</h1>
      <p className="text-body text-muted">Estos son tus grupos y materias asignados para 2026.</p>
    </div>
  );
}
