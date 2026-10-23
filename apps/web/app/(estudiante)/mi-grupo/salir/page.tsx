"use client";

import { Info, LogOut, Users } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Breadcrumb, MobileBack } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { leaveStudentGroup } from "@/lib/student";
import { useStudent } from "../../student-shell";

/** Salir / cambiar de código (Figma «estudiante-06»): confirmación antes de borrar la sesión. */
export default function SalirPage() {
  const router = useRouter();
  const { overview, status, reload } = useStudent();
  const [pending, setPending] = useState(false);

  if (!overview) {
    return status === "error" ? (
      <ErrorScreen onRetry={reload}>No pudimos cargar los datos de tu acceso.</ErrorScreen>
    ) : (
      <LoadingScreen text="Cargando tu acceso…" />
    );
  }

  const group = overview.group;

  async function salir() {
    setPending(true);
    await leaveStudentGroup();
    router.replace("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <MobileBack href="/mi-grupo" label="Mi grupo" />
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Mi grupo", href: "/mi-grupo" }, { label: "Salir" }]} />
        <header className="flex flex-col gap-1">
          <h1 className="text-[32px] font-semibold leading-tight text-ink">Salir del grupo</h1>
          <p className="text-body text-muted">Puedes regresar cuando quieras con tu código institucional.</p>
        </header>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <p className="text-meta font-semibold uppercase tracking-wide text-muted">Salir / cambiar código</p>

          <div className="flex items-start gap-3">
            <Info size={20} className="mt-1 shrink-0 text-primary" aria-hidden />
            <div className="flex flex-col gap-2">
              <h2 className="text-body font-semibold text-ink">
                <span className="hidden md:inline">¿Quieres salir de {group.label}?</span>
                <span className="md:hidden">¿Salir de este grupo?</span>
              </h2>
              <p className="text-meta text-muted">
                <span className="hidden md:inline">
                  Volverás a la pantalla de acceso por código. Para consultar tus guías de nuevo, deberás ingresar el
                  código de tu grupo.
                </span>
                <span className="md:hidden">
                  Volverás al acceso por código. Para regresar, ingresa de nuevo el código de tu grupo.
                </span>
              </p>
            </div>
          </div>

          <Notice title="Antes de continuar">
            No se elimina ningún material. Las guías que ya descargaste permanecen en tu dispositivo.
          </Notice>

          <div className="mt-2 flex flex-col gap-2 md:flex-row md:justify-end">
            <Button variant="secondary" onClick={() => router.push("/mi-grupo")} disabled={pending} className="order-2 md:order-1">
              Cancelar
            </Button>
            <Button onClick={() => void salir()} disabled={pending} className="order-1 md:order-2">
              <LogOut size={18} aria-hidden />
              {pending ? "Saliendo…" : "Salir del grupo"}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="text-body font-semibold text-ink">Tu acceso actual</h2>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-primary">
            <Users size={24} aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-section font-semibold text-ink">{group.label}</p>
            <p className="text-label text-muted">
              {group.shift} · {group.code}
            </p>
          </div>
          <p className="text-meta text-muted">
            Si necesitas ingresar a otro grupo, solicita su código a la institución. No necesitas crear una cuenta.
          </p>
        </section>
      </div>
    </div>
  );
}
