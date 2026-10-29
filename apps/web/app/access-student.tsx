"use client";

import { ArrowRight, KeyRound } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { FilterTabs, type TabOption } from "@/components/filter-tabs";
import { api } from "@/lib/api";

const PASOS = [
  "Ingresa el código de tu grupo",
  "Encuentra tus materias y temas",
  "Abre o descarga tus guías en PDF",
];

const TABS: TabOption[] = [
  { value: "estudiante", label: "Estudiante" },
  { value: "profesor", label: "Profesor" },
  { value: "administrador", label: "Administrador" },
];

const SIN_SESION = "El código no es válido. Verifícalo con tu institución e inténtalo de nuevo.";
const SIN_CONEXION = "No pudimos conectar con la plataforma. Revisa tu conexión e inténtalo de nuevo.";

/**
 * Acceso del estudiante por código (Figma «acceso-estudiante» y «acceso-estudiante-error»):
 * titular y pasos en escritorio, versión compacta en móvil, y el panel con el campo.
 * Las pestañas Profesor / Administrador apuntan a `/ingresar` (tarea WEB-03).
 */
export function AccessStudent() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await api.v1.access.$post({ json: { code } });
      if (!res.ok) {
        setError(SIN_SESION);
        return;
      }
      router.push("/materias");
    } catch {
      setError(SIN_CONEXION);
    } finally {
      setPending(false);
    }
  }

  function onTab(value: string) {
    if (value !== "estudiante") router.push("/ingresar");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-center gap-4 border-b border-line px-6 py-4 md:justify-between md:px-10">
        <div className="rounded-card border border-dashed border-line px-4 py-3 text-center">
          <p className="text-label font-semibold text-ink">Logo oficial de CENSA</p>
          <p className="text-meta text-muted">Espacio reservado</p>
        </div>
        <p className="hidden text-meta text-muted md:block">Plataforma educativa institucional</p>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 px-6 py-8 md:px-10 md:py-12 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16">
        {/* Escritorio (≥1024): presentación a la izquierda (Figma «acceso-estudiante»). */}
        <section className="hidden flex-col gap-5 lg:flex">
          <p className="text-meta font-semibold uppercase tracking-wide text-primary">Educación que te acompaña</p>
          <h1 className="text-display font-semibold leading-[1.1] text-ink">
            Tus materias y guías,
            <br />
            en un solo lugar.
          </h1>
          <p className="max-w-lg text-body text-muted">
            Consulta el material de tu grupo desde cualquier dispositivo. Solo necesitas el código que comparte tu
            institución.
          </p>
          <ol className="flex flex-col gap-4 rounded-card bg-tint p-6">
            {PASOS.map((paso, index) => (
              <li key={paso} className="flex items-center gap-3 text-body text-ink">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface text-label font-semibold text-primary">
                  {index + 1}
                </span>
                {paso}
              </li>
            ))}
          </ol>
        </section>

        {/* Panel del código: plano en móvil, tarjeta en escritorio. */}
        <section className="flex w-full flex-col gap-4 md:rounded-panel md:border md:border-line md:bg-surface md:p-6">
          <div className="flex flex-col gap-2 md:hidden">
            <h1 className="text-[32px] font-semibold leading-tight text-ink">Tu grupo, tus guías.</h1>
            <p className="text-body text-muted">
              Ingresa el código que te entregó tu institución para consultar tus materias.
            </p>
          </div>

          <div className="hidden flex-col gap-1 md:flex">
            <h2 className="text-section font-semibold text-ink">
              {error ? "Ingresa a tu grupo" : "Bienvenido a tu plataforma"}
            </h2>
            <p className="text-meta text-muted">Elige cómo quieres ingresar.</p>
          </div>

          <div className="hidden md:block">
            <FilterTabs
              options={TABS}
              value="estudiante"
              onChange={onTab}
              label="Elige cómo quieres ingresar"
            />
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Field
              label="Código de tu grupo"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="CENSA-4AM-K7Q"
              hint={
                error ? undefined : (
                  <>
                    <span className="md:hidden">Incluye las letras, los números y los guiones.</span>
                    <span className="hidden md:inline">Usa el código entregado por tu institución.</span>
                  </>
                )
              }
              error={error}
              errorTitle={
                <>
                  <span className="md:hidden">Código inválido</span>
                  <span className="hidden md:inline">No pudimos encontrar tu grupo</span>
                </>
              }
              autoComplete="off"
              autoCapitalize="characters"
              className="uppercase"
            />
            <Button type="submit" disabled={pending}>
              <ArrowRight size={18} aria-hidden />
              {pending ? "Ingresando…" : error ? "Intentar de nuevo" : "Ingresar a mi grupo"}
            </Button>
          </form>

          {/* Textos de confianza del Figma, que cambian entre escritorio y móvil. */}
          <div className="hidden flex-col gap-3 md:flex">
            {error ? (
              <>
                <p className="text-meta text-muted">
                  Revisa letras, números y guiones. Si tu institución cambió el código, solicita el más reciente.
                </p>
                <p className="text-meta text-muted">El acceso de estudiante no requiere crear una cuenta.</p>
              </>
            ) : (
              <p className="text-meta text-muted">No necesitas usuario, contraseña ni crear una cuenta.</p>
            )}
          </div>

          <div className="flex flex-col gap-4 md:hidden">
            {error && (
              <p className="text-meta text-muted">
                Comprueba letras, números y guiones. Si el código cambió, solicita el nuevo a tu institución.
              </p>
            )}
            <div className="flex items-start gap-3 rounded-card border border-line bg-tint p-4">
              <KeyRound size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div className="flex flex-col gap-1">
                {error ? (
                  <p className="text-meta text-ink">El acceso es solo por código. No necesitas crear una cuenta.</p>
                ) : (
                  <>
                    <p className="text-label font-semibold text-ink">Solo necesitas el código</p>
                    <p className="text-meta text-muted">No necesitas usuario, contraseña ni crear una cuenta.</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col items-start gap-1 border-t border-line px-6 py-4 text-meta text-muted md:flex-row md:items-center md:justify-between md:px-10">
        <span>
          <span className="hidden md:inline">¿No tienes tu código? Solicítalo a tu institución.</span>
          <span className="md:hidden">¿No tienes el código o no lo recuerdas? Solicítalo a tu institución.</span>
        </span>
        <span>CENSA · Plataforma educativa · 2026</span>
      </footer>
    </div>
  );
}
