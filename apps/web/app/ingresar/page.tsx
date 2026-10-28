import Link from "next/link";
import { StaffLoginForm } from "./staff-login-form";

export const metadata = {
  title: "Iniciar sesión · CensaGuias",
};

// Acceso del staff (Figma `acceso-staff.png` y `acceso-staff-error.png`).
// El formulario es cliente: el login pasa por la API y la sesión se guarda con Supabase Auth.
const accesos = [
  { numero: "1", rol: "Profesor", detalle: "Grupos y materias asignados" },
  { numero: "2", rol: "Administrador", detalle: "Gestión académica" },
];

export default function StaffLoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between gap-4 px-6 py-6 md:px-12">
        <div className="rounded-card border border-dashed border-line px-4 py-3">
          <p className="text-label font-semibold text-ink">Logo oficial de CENSA</p>
          <p className="text-meta text-muted">Espacio reservado</p>
        </div>
        <p className="text-meta text-muted">Plataforma educativa institucional</p>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-10 px-6 py-10 lg:flex-row lg:items-start lg:gap-16 lg:py-16">
        <section className="w-full max-w-md">
          <p className="text-meta uppercase tracking-[0.12em] text-muted">Educación que te acompaña</p>
          <h1 className="mt-4 text-display font-semibold text-ink">Tu espacio para enseñar y gestionar.</h1>
          <p className="mt-5 text-body text-muted">
            Accede con las credenciales entregadas por tu institución. Cada rol tiene un espacio de trabajo seguro y definido.
          </p>
          <ol className="mt-6 flex flex-col gap-3 rounded-panel bg-tint p-5">
            {accesos.map((acceso) => (
              <li key={acceso.numero} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-meta font-semibold text-muted">
                  {acceso.numero}
                </span>
                <p className="text-label">
                  <span className="font-semibold text-ink">{acceso.rol}</span>{" "}
                  <span className="text-muted">· {acceso.detalle}</span>
                </p>
              </li>
            ))}
            <li className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-meta font-semibold text-muted">
                3
              </span>
              <p className="text-label text-muted">Acceso reservado al personal institucional</p>
            </li>
          </ol>
        </section>

        <section className="w-full max-w-md">
          <StaffLoginForm />
        </section>
      </main>

      <footer className="flex flex-col gap-2 border-t border-line px-6 py-5 text-meta text-muted md:px-12 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <Link href="/" className="hover:text-primary">
            ¿No tienes tu código? Solicítalo a tu institución.
          </Link>
        </p>
        <p>CENSA · Plataforma educativa · 2026</p>
      </footer>
    </div>
  );
}
