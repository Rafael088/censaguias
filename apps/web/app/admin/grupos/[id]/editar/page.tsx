"use client";

import { RefreshCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { cleiLabel, groupLabel } from "@censaguias/shared";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { CodeChip } from "@/components/code-chip";
import { Dialog } from "@/components/dialog";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { GroupDeleteDialog } from "@/components/group-delete-dialog";
import { Notice } from "@/components/notice";
import { Select } from "@/components/select";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import {
  NoStaffSession,
  getGroup,
  regenerateGroupCode,
  subjectsCount,
  updateGroup,
  validateGroupForm,
  type AdminGroup,
  type GroupFormErrors,
} from "@/lib/admin";

const CLEIS = [1, 2, 3, 4, 5, 6];

const JORNADAS: { value: string; label: string }[] = [
  { value: "morning", label: "Mañana" },
  { value: "night", label: "Noche" },
  { value: "saturday", label: "Sabatina" },
];

/** Editar grupo CLEI (Figma `admin-04-editar-grupo`): datos, código vigente con regeneración y eliminar. */
export default function EditarGrupoPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [grupo, setGrupo] = useState<AdminGroup | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFallo(false);
    setNoExiste(false);
    getGroup(id)
      .then((found) => {
        if (cancelled) return;
        if (found) setGrupo(found);
        else setNoExiste(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof NoStaffSession) {
          router.replace("/ingresar");
          return;
        }
        console.warn("[WEB-04] No se pudo cargar el grupo:", error);
        setFallo(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, intento, router]);

  if (fallo) {
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar este grupo.</ErrorScreen>;
  }

  if (noExiste) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Breadcrumb items={[{ label: "Grupos CLEI", href: "/admin/grupos" }, { label: "Editar" }]} />
        <EmptyState
          title="No encontramos este grupo"
          description="Puede que ya se haya eliminado. Vuelve a la lista para ver los grupos disponibles."
          action={
            <Button variant="secondary" onClick={() => router.push("/admin/grupos")}>
              Volver a grupos
            </Button>
          }
        />
      </div>
    );
  }

  if (!grupo) return <LoadingScreen text="Cargando el grupo…" />;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Breadcrumb
        items={[{ label: "Grupos CLEI", href: "/admin/grupos" }, { label: groupLabel(grupo) }, { label: "Editar" }]}
      />
      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">Editar grupo</h1>
        <p className="text-body text-muted">
          Actualiza los datos de {grupo.label} sin perder su contexto académico.
        </p>
      </header>
      <FormularioGrupo
        key={grupo.id}
        grupo={grupo}
        onGrupoCambio={setGrupo}
        onEliminado={() => router.replace(`/admin/grupos?eliminado=${encodeURIComponent(grupo.label)}`)}
      />
    </div>
  );
}

interface Aviso {
  titulo: string;
  texto: string;
  /** Si la acción cambió el código, para copiarlo desde el aviso. */
  copiar?: string;
}

function FormularioGrupo({
  grupo,
  onGrupoCambio,
  onEliminado,
}: {
  grupo: AdminGroup;
  onGrupoCambio: (group: AdminGroup) => void;
  onEliminado: () => void;
}) {
  const router = useRouter();
  const [clei, setClei] = useState(String(grupo.clei));
  const [identifier, setIdentifier] = useState(grupo.identifier);
  const [shift, setShift] = useState<string>(grupo.shift);
  const [codigo, setCodigo] = useState(grupo.accessCode);
  const [errores, setErrores] = useState<GroupFormErrors>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [confirmandoCodigo, setConfirmandoCodigo] = useState(false);
  const [abriendoEliminar, setAbriendoEliminar] = useState(false);

  const materias = subjectsCount(grupo);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors, input } = validateGroupForm({ clei, identifier, shift });
    setErrores(errors);
    setErrorApi(null);
    setAviso(null);
    if (!input) return;

    // La API responde «No se envió ningún cambio»: lo decimos aquí, sin viaje.
    if (input.clei === grupo.clei && input.identifier === grupo.identifier && input.shift === grupo.shift) {
      setErrorApi("No hay cambios por guardar. Modifica los datos del grupo antes de continuar.");
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await updateGroup(grupo.id, input);
      onGrupoCambio(actualizado);
      setAviso({
        titulo: "Cambios guardados",
        texto: `Los datos de ${actualizado.label} se actualizaron. El código de acceso no cambió.`,
      });
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-04] No se pudieron guardar los cambios:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }

  async function regenerar() {
    setRegenerando(true);
    setErrorCodigo(null);
    try {
      const nuevo = await regenerateGroupCode(grupo.id);
      setCodigo(nuevo.accessCode);
      onGrupoCambio({ ...grupo, accessCode: nuevo.accessCode, codeVersion: nuevo.codeVersion });
      setConfirmandoCodigo(false);
      setAviso({
        titulo: "Código regenerado",
        texto: `El código de ${grupo.label} cambió. Comparte el nuevo con el grupo antes de continuar.`,
        copiar: nuevo.accessCode,
      });
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-04] No se pudo regenerar el código:", err);
      setErrorCodigo(err instanceof Error ? err.message : "No pudimos regenerar el código.");
    } finally {
      setRegenerando(false);
    }
  }

  return (
    <>
      {aviso && (
        <Notice tone="success" title={aviso.titulo}>
          <span className="block">{aviso.texto}</span>
          {aviso.copiar && <CodeChip code={aviso.copiar} className="mt-2" />}
        </Notice>
      )}

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
                  {CLEIS.map((n) => (
                    <option key={n} value={n}>
                      {cleiLabel(n)}
                    </option>
                  ))}
                </Select>
                <Field
                  label="Identificador de grupo *"
                  value={identifier}
                  error={errores.identifier}
                  autoComplete="off"
                  onChange={(event) => setIdentifier(event.target.value.toUpperCase())}
                />
                <div className="sm:col-span-2">
                  <Select
                    label="Jornada *"
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
              <p className="text-meta text-muted">
                {materias} {materias === 1 ? "materia" : "materias"} · Año lectivo {grupo.schoolYear}
              </p>
            </section>

            <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
              <h2 className="text-body font-semibold text-ink">Código de acceso vigente</h2>
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-semibold text-ink">Código único del grupo</span>
                <input
                  readOnly
                  aria-label="Código único del grupo"
                  value={codigo}
                  className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-ink"
                />
              </div>
              <Notice title="Regenerar invalida el código anterior">
                Los estudiantes deberán ingresar con el nuevo código. Comparte el cambio con {grupo.label} antes de
                continuar.
              </Notice>
              <div>
                <Button variant="secondary" onClick={() => setConfirmandoCodigo(true)}>
                  <RefreshCw size={16} aria-hidden />
                  Regenerar código
                </Button>
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
            <h2 className="text-body font-semibold text-ink">Mantén el acceso organizado</h2>
            <p className="text-meta text-muted">
              Este código pertenece únicamente a {grupo.label}, jornada {grupo.shiftLabel}.
            </p>
            <p className="text-meta text-muted">
              Cambiar el nombre o la jornada no cambia el código automáticamente.
            </p>
            <p className="text-meta text-muted">
              Las materias y los docentes asignados se administran desde el detalle del grupo.
            </p>
          </aside>
        </div>

        {errorApi && (
          <Notice tone="error" title="No pudimos guardar los cambios">
            {errorApi}
          </Notice>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" disabled={guardando} onClick={() => router.push("/admin/grupos")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
        <h2 className="text-body font-semibold text-ink">Eliminar grupo</h2>
        <p className="text-meta text-muted">
          Se eliminarán {grupo.label}, sus {materias} {materias === 1 ? "materia" : "materias"} y sus guías, junto con
          el código {codigo}. Los estudiantes perderán el acceso. Esta acción no se puede deshacer.
        </p>
        <div>
          <Button variant="secondary" onClick={() => setAbriendoEliminar(true)}>
            Eliminar grupo
          </Button>
        </div>
      </section>

      <Dialog
        open={confirmandoCodigo}
        onClose={() => setConfirmandoCodigo(false)}
        title={`¿Regenerar el código de ${grupo.label}?`}
        description={`Se reemplazará ${codigo} por uno nuevo para todo el grupo.`}
        actions={
          <>
            <Button variant="secondary" disabled={regenerando} onClick={() => setConfirmandoCodigo(false)}>
              Cancelar
            </Button>
            <Button disabled={regenerando} onClick={() => void regenerar()}>
              {regenerando ? "Regenerando…" : "Regenerar código"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Notice title="Antes de continuar">
            Los estudiantes deberán ingresar con el nuevo código. Comparte el cambio con {grupo.label} antes de
            continuar. Esta acción no se puede deshacer.
          </Notice>
          {errorCodigo && (
            <Notice tone="error" title="No pudimos regenerar el código">
              {errorCodigo}
            </Notice>
          )}
        </div>
      </Dialog>

      <GroupDeleteDialog
        group={grupo}
        open={abriendoEliminar}
        onClose={() => setAbriendoEliminar(false)}
        onDeleted={onEliminado}
      />
    </>
  );
}
