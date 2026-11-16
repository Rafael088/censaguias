"use client";

import { FileText, Layers } from "lucide-react";
import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";

// Navegación del Figma `profesor-01-mis-grupos`: Mis grupos (el inicio) · Mis guías.
export default function ProfesorLayout({ children }: { children: ReactNode }) {
  return (
    <StaffShell
      role="teacher"
      space="Espacio docente"
      items={[
        { label: "Mis grupos", href: "/profesor", icon: Layers },
        { label: "Mis guías", href: "/profesor/guias", icon: FileText },
      ]}
    >
      {children}
    </StaffShell>
  );
}
