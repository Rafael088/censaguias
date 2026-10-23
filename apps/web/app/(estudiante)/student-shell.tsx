"use client";

import { BookOpen, KeyRound, LogOut, Users } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { Sidebar } from "@/components/sidebar";
import { getStudentOverview, type StudentOverview } from "@/lib/student";

export type StudentStatus = "cargando" | "listo" | "error";

interface StudentValue {
  overview: StudentOverview | null;
  status: StudentStatus;
  /** Vuelve a pedir el grupo (botón «Intentar de nuevo»). */
  reload: () => void;
}

const StudentContext = createContext<StudentValue>({ overview: null, status: "cargando", reload: () => {} });

/** Datos del grupo compartidos por todas las pantallas del estudiante. */
export function useStudent(): StudentValue {
  return useContext(StudentContext);
}

/**
 * Envoltorio del espacio estudiante (Figma «estudiante-*»): barra lateral de 244 px
 * en escritorio, barra superior + navegación inferior en móvil.
 *
 * Carga el grupo una sola vez y redirige al acceso si la API responde 401
 * (no hay sesión o el código cambió).
 */
export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [status, setStatus] = useState<StudentStatus>("cargando");

  const cargar = useCallback(() => {
    setStatus("cargando");
    getStudentOverview()
      .then((data) => {
        if (!data) {
          router.replace("/");
          return;
        }
        setOverview(data);
        setStatus("listo");
      })
      .catch((error: unknown) => {
        console.warn("[WEB-02] No se pudo cargar el grupo del estudiante:", error);
        setStatus("error");
      });
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esDetalle = pathname.startsWith("/materias/") || pathname.startsWith("/guias/");
  const activo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const value = useMemo<StudentValue>(() => ({ overview, status, reload: cargar }), [overview, status, cargar]);

  const group = overview?.group;

  return (
    <StudentContext.Provider value={value}>
      <div className="flex min-h-dvh bg-surface">
        {/* Escritorio: barra lateral por rol */}
        <div className="hidden md:block">
          <Sidebar
            space="Espacio estudiante"
            items={[
              { label: "Materias", href: "/materias", icon: BookOpen, active: activo("/materias") },
              { label: "Mi grupo", href: "/mi-grupo", icon: Users, active: activo("/mi-grupo") },
            ]}
            help="Acceso por código de grupo. No necesitas una cuenta."
            action={{ label: "Cambiar código", icon: LogOut, href: "/mi-grupo/salir" }}
          />
        </div>

        <div className="flex min-h-dvh flex-1 flex-col">
          {group && (
            <div className="hidden items-start justify-between gap-4 border-b border-line px-10 py-5 md:flex">
              <p className="text-meta text-muted">CENSA / Gestión académica · {group.schoolYear}</p>
              <div className="flex items-start gap-2">
                <KeyRound size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <div className="text-right">
                  <p className="text-label font-semibold text-ink">{group.label}</p>
                  <p className="text-meta text-muted">{group.shift} · Acceso de grupo</p>
                </div>
              </div>
            </div>
          )}

          {/* Móvil: barra superior. En las pantallas de detalle la sustituye el «Volver» de la propia página. */}
          {!esDetalle && (
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4 md:hidden">
              <span className="flex items-center gap-2 text-label font-semibold text-ink">
                <BookOpen size={20} aria-hidden />
                Plataforma educativa
              </span>
              <Link
                href="/mi-grupo/salir"
                aria-label="Salir del grupo"
                className="grid h-11 w-11 place-items-center rounded-control text-primary outline-none hover:bg-tint"
              >
                <LogOut size={20} aria-hidden />
              </Link>
            </div>
          )}

          <main className="flex-1 px-6 py-6 pb-28 md:px-10 md:py-8 md:pb-10">
            {children}
            <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 text-meta text-muted">
              <span>Plataforma educativa CENSA</span>
              <span>Datos ilustrativos · Año lectivo {group?.schoolYear ?? ""}</span>
            </footer>
          </main>
        </div>

        <BottomNav
          items={[
            { label: "Materias", href: "/materias", icon: BookOpen, active: activo("/materias") },
            { label: "Mi grupo", href: "/mi-grupo", icon: Users, active: activo("/mi-grupo") },
          ]}
        />
      </div>
    </StudentContext.Provider>
  );
}
