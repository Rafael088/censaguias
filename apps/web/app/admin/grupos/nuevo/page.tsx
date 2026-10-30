"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SHIFT_LABEL, cleiLabel } from "@censaguias/shared";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { CodeChip } from "@/components/code-chip";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Select } from "@/components/select";
import {
  CURRENT_SCHOOL_YEAR,
  NoStaffSession,
  createGroup,
  validateGroupForm,
  type AdminGroup,
  type GroupFormErrors,
} from "@/lib/admin";

const CLEIS = [1, 2, 3, 4, 5, 6];

const JORNADAS: { value: string; label: string }[] = [
  { value: "", label: "Selecciona una jornada" },
  { value: "morning", label: SHIFT_LABEL.morning },
  { value: "night", label: SHIFT_LABEL.night },
  { value: "saturday", label: SHIFT_LABEL.saturday },
];

/**
 * Crear grupo CLEI (Figma `admin-03-crear-grupo`): datos del grupo, código que se
 * genera al guardar y la tarjeta «Crea, asigna y comparte». Al crear, el código se
 * muestra con su botón de copiar (admin-10 «Grupo creado correctamente»).
 */
export default function NuevoGrupo() {
  const router = useRouter();
  const [clei, setClei] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [shift, setShift] = useState("");
  const [errores, setErrores] = useState<GroupFormErrors>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<AdminGroup | null>(null);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors, input } = validateGroupForm({ clei, identifier, shift });
    setErrores(errors);
    setErrorApi(null);
    if (!input) return;

    setGuardando(true);
    try {
      setCreado(await createGroup({ ...input, schoolYear: CURRENT_SCHOOL_YEAR }));
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-04] No se pudo crear el grupo:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos crear el grupo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Breadcrumb items={[{ label: "Grupos CLEI", href: "/admin/grupos" }, { label: "Nuevo grupo" }]} />

      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">
          {creado ? "Grupo creado" : "Crear grupo CLEI"}
        </h1>
        <p className="text-body text-muted">
          {creado
            ? "Ya puede recibir materias, docentes y guías publicadas."
            : "Define el grupo y su jornada. Después podrás añadir sus materias."}
        </p>
      </header>

      {creado ? (
        <div className="flex flex-col gap-4">
          <Notice tone="success" title="Grupo creado correctamente">
            {creado.label} · {creado.shiftLabel}. El código de acceso es {creado.accessCode}. Ya puedes añadir
            materias.
          </Notice>

          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-body font-semibold text-ink">Código de acceso</h2>
              <p className="text-meta text-muted">
                Compártelo con los estudiantes del grupo. Es único y no se reutiliza en otros grupos ni jornadas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-label font-semibold text-ink">Código del grupo</p>
              <CodeChip code={creado.accessCode} />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => router.push("/admin/grupos")}>
                Volver a grupos
              </Button>
              {/* El detalle con materias y docentes lo construye WEB-05 (admin-05). */}
              <Link
                href={`/admin/grupos/${creado.id}`}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-control bg-primary px-4 text-body font-semibold text-white outline-none hover:opacity-90"
              >
                Añadir materias
              </Link>
            </div>
          </section>
        </div>
      ) : (
        <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
              <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
                <h2 className="text-body font-semibold text-ink">Datos del grupo</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="CLEI *"
                    value={clei}
                    error={errores.clei}
                    onChange={(event) => setClei(event.target.value)}
                  >
                    <option value="">Selecciona un CLEI</option>
                    {CLEIS.map((n) => (
                      <option key={n} value={n}>
                        {cleiLabel(n)}
                      </option>
                    ))}
                  </Select>
                  <Field
                    label="Identificador de grupo *"
                    placeholder="Ej. A, B o C"
                    value={identifier}
                    error={errores.identifier}
                    autoComplete="off"
                    onChange={(event) => setIdentifier(event.target.value.toUpperCase())}
                  />
                  <div className="sm:col-span-2">
                    <Select
                      label="Jornada *"
                      hint="Opciones disponibles: Mañana, Noche y Sabatina."
                      value={shift}
                      error={errores.shift}
                      onChange={(event) => setShift(event.target.value)}
                    >
                      {JORNADAS.map((jornada) => (
                        <option key={jornada.value} value={jornada.value}>
                          {jornada.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <p className="text-meta text-muted">* Campos obligatorios</p>
              </section>

              <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
                <div className="flex flex-col gap-1">
                  <h2 className="text-body font-semibold text-ink">Código de acceso</h2>
                  <p className="text-meta text-muted">
                    El sistema generará un código único al guardar el grupo.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-label font-semibold text-ink">Código del grupo</span>
                  <input
                    readOnly
                    aria-label="Código del grupo"
                    value="Se genera automáticamente"
                    className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-muted"
                  />
                </div>
                <Notice title="Acceso exclusivo al grupo">
                  Este código permite consultar sus materias y guías publicadas, sin registrar estudiantes.
                </Notice>
              </section>
            </div>

            <aside className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
              <h2 className="text-body font-semibold text-ink">Crea, asigna y comparte</h2>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-meta text-muted">
                <li>Guarda los datos del grupo.</li>
                <li>Añade las materias y asigna un docente registrado a cada una.</li>
                <li>Comparte el código con los estudiantes del grupo.</li>
              </ol>
              <p className="text-meta text-muted">
                El código es único. No se reutiliza en otros grupos ni jornadas.
              </p>
            </aside>
          </div>

          {errorApi && (
            <Notice tone="error" title="No pudimos crear el grupo">
              {errorApi}
            </Notice>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={guardando} onClick={() => router.push("/admin/grupos")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              <Plus size={18} aria-hidden />
              {guardando ? "Guardando…" : "Guardar grupo"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
