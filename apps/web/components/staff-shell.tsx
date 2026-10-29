"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Sidebar, type SidebarItem } from "@/components/sidebar";
import { api } from "@/lib/api";
import { signOutStaff } from "@/lib/supabase";

/** Perfil de GET /v1/me. El tipo sale de la API, no se escribe a mano (regla 5). */
type Me = Awaited<ReturnType<Awaited<ReturnType<typeof api.v1.me.$get>>["json"]>>;

const ProfileContext = createContext<Me | null>(null);

/** Perfil del staff que ya cargó el shell: rol, nombre y materias. Para las páginas del área. */
export function useStaffProfile(): Me {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error("useStaffProfile solo puede usarse dentro de <StaffShell>.");
  return profile;
}

export interface StaffShellProps {
  /** Rol que admite esta área: el guard manda a otro rol a su propio espacio. */
  role: "admin" | "teacher";
  /** «Administración» · «Espacio docente» (Figma barra lateral). */
  space: string;
  items: SidebarItem[];
  children: ReactNode;
}

/**
 * Armazón del staff (Figma `admin-01` y `profesor-01`): barra lateral, cabecera con nombre y
 * rol, y el guard por rol. El rol sale de `/v1/me`, que a su vez lo lee de `profiles`:
 * la pestaña de login o lo que escriba el usuario no deciden nada (regla 7).
 */
export function StaffShell({ role, space, items, children }: StaffShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const me = await loadProfile();
      if (!alive || !me) return;
      if (me.role !== role) {
        router.replace(me.role === "admin" ? "/admin" : "/profesor");
        return;
      }
      setProfile(me);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadProfile solo usa router.
  }, [role, router]);

  async function loadProfile(): Promise<Me | null> {
    try {
      const res = await api.v1.me.$get();
      // 401: sin sesión o token vencido. 403: cuenta desactivada. En los dos, al acceso.
      if (res.status === 401 || res.status === 403) {
        router.replace("/ingresar");
        return null;
      }
      if (!res.ok) throw new Error(`GET /v1/me respondió ${res.status}`);
      return await res.json();
    } catch {
      // Sin API no hay sesión verificable: no se pinta nada y se vuelve al acceso.
      router.replace("/ingresar");
      return null;
    }
  }

  // El activo es el punto más específico: /admin/grupos apaga a /admin.
  const activeHref = useMemo(() => {
    const matches = items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    return [...matches].sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [items, pathname]);

  async function onSignOut() {
    await signOutStaff();
    router.replace("/ingresar");
  }

  if (!profile) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-body text-muted">Cargando tu perfil…</p>
      </main>
    );
  }

  // Figma: el profesor ve su nombre y su materia; el admin, el rol y «Personal institucional».
  // «Profesora» del mock es el persona Laura; usamos el genérico «Profesor», como las pestañas.
  const teacher = profile.role === "teacher";
  const title = teacher ? profile.fullName : "Administrador";
  const subtitle = teacher
    ? profile.subjects[0]
      ? `Profesor · ${profile.subjects[0].name}`
      : "Profesor"
    : "Personal institucional";

  return (
    <ProfileContext.Provider value={profile}>
      <div className="flex min-h-dvh bg-surface">
        <div className="hidden md:block">
          <Sidebar
            space={space}
            items={items.map((item) => ({ ...item, active: item.href === activeHref }))}
            help="¿Necesitas ayuda? Contacta al soporte institucional."
            action={{ label: "Cerrar sesión", icon: LogOut, onClick: onSignOut }}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
            <p className="text-meta text-muted">CENSA / Gestión académica · 2026</p>
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-tint text-primary">
                <UserRound size={18} aria-hidden />
              </div>
              <div className="text-right">
                <p className="text-label font-semibold text-ink">{title}</p>
                <p className="text-meta text-muted">{subtitle}</p>
              </div>
            </div>
          </header>
          {/* Móvil: la barra lateral no cabe; la navegación pasa a la cabecera (WEB-08 revisa el móvil). */}
          <nav className="flex items-center gap-2 overflow-x-auto border-b border-line px-4 py-3 md:hidden" aria-label={space}>
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-control px-3 py-2 text-label font-semibold whitespace-nowrap ${
                  item.href === activeHref ? "bg-primary text-white" : "text-ink hover:bg-tint"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={onSignOut}
              className="ml-auto rounded-control border border-line px-3 py-2 text-label font-semibold whitespace-nowrap text-primary"
            >
              Cerrar sesión
            </button>
          </nav>
          <main className="flex-1 px-6 py-8">{children}</main>
        </div>
      </div>
    </ProfileContext.Provider>
  );
}
