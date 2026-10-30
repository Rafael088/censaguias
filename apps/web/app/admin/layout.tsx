"use client";

import { LayoutDashboard, Layers, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff-shell";

// Navegación del Figma `admin-01-resumen`: Resumen · Grupos CLEI · Profesores.
// «Grupos CLEI» se construyó en WEB-04 (lista, crear y editar); «Profesores» llega en WEB-06.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <StaffShell
      role="admin"
      space="Administración"
      items={[
        { label: "Resumen", href: "/admin", icon: LayoutDashboard },
        { label: "Grupos CLEI", href: "/admin/grupos", icon: Layers },
        { label: "Profesores", href: "/admin/profesores", icon: UserRound },
      ]}
    >
      {children}
    </StaffShell>
  );
}
