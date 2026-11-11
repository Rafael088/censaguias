"use client";

import { Check, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { SHIFT_LABEL, type Shift } from "@censaguias/shared";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { Dialog } from "@/components/dialog";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Select } from "@/components/select";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import { TeacherDeleteDialog } from "@/components/teacher-delete-dialog";
import {
  assignSlot,
  assignmentsSummary,
  availableSlots,
  deleteDescription,
  firstName,
  getTeacher,
  resetTeacherPassword,
  unassign,
  updateTeacher,
  validateProfileForm,
  type AdminTeacher,
  type SubjectSlot,
  type TeacherAssignment,
  type TeacherFormErrors,
} from "@/lib/teachers";

/**
 * Detalle del profesor (Figma `admin-09-detalle-profesor`): datos editables,
 * referencia del alta, restablecer la contraseña temporal, asignaciones con
 * añadir / cambiar / quitar y eliminar con confirmación (admin-10).
 *
 * TODO(API-08): hoy sirve la muestra de `lib/teachers.ts`; con `GET/PATCH/DELETE
 * /v1/teachers/:id` y `POST /:id/password` solo cambia esa capa.
 */
export default function DetalleProfesorPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [teacher, setTeacher] = useState<AdminTeacher | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFallo(false);
    setNoExiste(false);
    getTeacher(id)
      .then((found) => {
        if (cancelled) return;
        if (found) setTeacher(found);
        else setNoExiste(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[WEB-06] No se pudo cargar al profesor:", error);
        setFallo(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id, intento]);

  if (fallo) {
    return <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>No pudimos cargar a este profesor.</ErrorScreen>;
  }

  if (noExiste) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Breadcrumb items={[{ label: "Profesores", href: "/admin/profesores" }, { label: "Detalle" }]} />
        <EmptyState
          title="No encontramos a este profesor"
          description="Puede que ya se haya eliminado. Vuelve a la lista para ver los docentes registrados."
          action={
            <Button variant="secondary" onClick={() => router.push("/admin/profesores")}>
              Volver a profesores
            </Button>
          }
        />
      </div>
    );
  }

  if (!teacher) return <LoadingScreen text="Cargando al profesor…" />;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Breadcrumb
        items={[{ label: "Profesores", href: "/admin/profesores" }, { label: "Detalle y administración" }]}
      />
      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">{teacher.fullName}</h1>
        <p className="text-body text-muted">Registro del docente y asignaciones académicas.</p>
      </header>

      <DetalleProfesor
        teacher={teacher}
        onTeacher={setTeacher}
        onDeleted={() =>
          router.replace(`/admin/profesores?eliminado=${encodeURIComponent(teacher.fullName)}`)
        }
      />
    </div>
  );
}

interface Aviso {
  titulo: string;
  texto: string;
}

function DetalleProfesor({
  teacher,
  onTeacher,
  onDeleted,
}: {
  teacher: AdminTeacher;
  onTeacher: (teacher: AdminTeacher) => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(teacher.fullName);
  const [username, setUsername] = useState(teacher.username);
  const [errores, setErrores] = useState<TeacherFormErrors>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [restableciendo, setRestableciendo] = useState(false);
  const [passwordNueva, setPasswordNueva] = useState<string | null>(null);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);

  const [slots, setSlots] = useState<SubjectSlot[]>([]);
  const [asignando, setAsignando] = useState<{ open: boolean; assignment: TeacherAssignment | null }>({
    open: false,
    assignment: null,
  });
  const [aQuitar, setAQuitar] = useState<TeacherAssignment | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const nombre = firstName(teacher.fullName);

  // Las materias disponibles se piden al abrir el diálogo, no en cada render.
  useEffect(() => {
    if (!asignando.open) return;
    let alive = true;
    availableSlots(teacher.id)
      .then((found) => {
        if (alive) setSlots(found);
      })
      .catch((error: unknown) => {
        console.warn("[WEB-06] No se pudieron cargar las materias disponibles:", error);
        if (alive) setSlots([]);
      });
    return () => {
      alive = false;
    };
  }, [asignando.open, teacher.id]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors, input } = validateProfileForm({ fullName, username });
    setErrores(errors);
    setErrorApi(null);
    setAviso(null);
    if (!input) return;

    // La API responde «No se envió ningún cambio»: lo decimos aquí, sin viaje.
    if (input.fullName === teacher.fullName && input.username === teacher.username) {
      setErrorApi("No hay cambios por guardar. Modifica los datos del profesor antes de continuar.");
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await updateTeacher(teacher.id, input);
      onTeacher(actualizado);
      setAviso({
        titulo: "Datos guardados",
        texto: `Los datos de ${actualizado.fullName} se actualizaron. El usuario sigue siendo ${actualizado.username}.`,
      });
    } catch (err) {
      console.warn("[WEB-06] No se pudieron guardar los datos:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos guardar los datos.");
    } finally {
      setGuardando(false);
    }
  }

  async function restablecer() {
    setRestableciendo(true);
    setErrorPassword(null);
    setPasswordNueva(null);
    try {
      setPasswordNueva(await resetTeacherPassword(teacher.id));
    } catch (err) {
      console.warn("[WEB-06] No se pudo restablecer la contraseña:", err);
      setErrorPassword(err instanceof Error ? err.message : "No pudimos restablecer la contraseña.");
    } finally {
      setRestableciendo(false);
    }
  }

  async function confirmarQuitar() {
    if (!aQuitar) return;
    setQuitando(true);
    setErrorQuitar(null);
    try {
      const actualizado = await unassign(teacher.id, aQuitar.id);
      onTeacher(actualizado);
      setAviso({
        titulo: "Asignación quitada",
        texto: `${aQuitar.subject.name} (${aQuitar.group.label}) quedó sin docente. Sus guías publicadas se conservan.`,
      });
      setAQuitar(null);
    } catch (err) {
      console.warn("[WEB-06] No se pudo quitar la asignación:", err);
      setErrorQuitar(err instanceof Error ? err.message : "No pudimos quitar la asignación.");
    } finally {
      setQuitando(false);
    }
  }

  async function guardarAsignacion(slotId: string): Promise<void> {
    // Se añade primero y se quita después: si el segundo paso fallara, no se
    // pierde la asignación que ya tenía.
    const previa = asignando.assignment;
    let actualizado = await assignSlot(teacher.id, slotId);
    if (previa) actualizado = await unassign(actualizado.id, previa.id);

    onTeacher(actualizado);
    const materia = actualizado.assignments.find((assignment) => assignment.subject.id === slotId);
    setAviso({
      titulo: previa ? "Asignación actualizada" : "Asignación añadida",
      texto: materia
        ? `${nombre} ahora gestiona ${materia.subject.name} en ${materia.group.label}.`
        : "La asignación se guardó.",
    });
    setAsignando({ open: false, assignment: null });
  }

  return (
    <>
      {aviso && (
        <Notice tone="success" title={aviso.titulo}>
          {aviso.texto}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-body font-semibold text-ink">Datos del docente</h2>
            <span className="inline-flex items-center gap-1.5 rounded-control border border-line bg-tint px-2.5 py-1 text-meta font-semibold text-ink">
              <Check size={16} aria-hidden />
              {teacher.active ? "Activo" : "Inactivo"}
            </span>
          </div>
          <Field
            label="Nombre completo *"
            value={fullName}
            error={errores.fullName}
            autoComplete="off"
            onChange={(event) => setFullName(event.target.value)}
          />
          <Field
            label="Usuario institucional *"
            value={username}
            error={errores.username}
            autoComplete="off"
            onChange={(event) => setUsername(event.target.value.toLowerCase())}
          />
          <p className="text-meta text-muted">Docente registrado. La contraseña actual nunca se muestra.</p>
          {errorApi && (
            <Notice tone="error" title="No pudimos guardar los datos">
              {errorApi}
            </Notice>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar datos"}
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-body font-semibold text-ink">Al registrar un nuevo profesor</h2>
              <p className="text-meta text-muted">
                Referencia del formulario de registro: solicita nombre, usuario y una contraseña temporal.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="contrasena-alta" className="text-label font-semibold text-ink">
                Contraseña temporal · Solo al registrar
              </label>
              <input
                id="contrasena-alta"
                readOnly
                placeholder="Definir contraseña inicial"
                className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-muted"
              />
              <p className="text-meta text-muted">Visible únicamente durante el alta de un nuevo docente.</p>
            </div>
            <div>
              <Button variant="secondary" onClick={() => router.push("/admin/profesores/nuevo")}>
                Registrar nuevo profesor
              </Button>
            </div>
            <Notice title="Entrega segura de credenciales">
              Comparte el usuario y la contraseña temporal directamente con el profesor. Los estudiantes no usan estas
              credenciales.
            </Notice>
          </section>

          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-body font-semibold text-ink">Restablecer contraseña</h2>
              <p className="text-meta text-muted">
                Genera una contraseña temporal nueva. La anterior deja de funcionar al instante.
              </p>
            </div>
            {passwordNueva && (
              <Notice tone="success" title="Contraseña temporal nueva">
                Compártela con {nombre}: <strong className="font-semibold">{passwordNueva}</strong>. No se vuelve a
                mostrar.
              </Notice>
            )}
            {errorPassword && (
              <Notice tone="error" title="No pudimos restablecer la contraseña">
                {errorPassword}
              </Notice>
            )}
            <div className="flex justify-end">
              <Button onClick={() => void restablecer()} disabled={restableciendo}>
                {restableciendo ? "Generando…" : "Restablecer contraseña"}
              </Button>
            </div>
          </section>
        </div>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-section font-semibold text-ink">Asignaciones de {nombre}</h2>
          <Button onClick={() => setAsignando({ open: true, assignment: null })}>
            <Plus size={18} aria-hidden />
            Añadir asignación
          </Button>
        </div>

        {teacher.assignments.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="Sin asignaciones todavía"
            description={`${nombre} no tiene materias asignadas. Añade una para que pueda crear y publicar guías.`}
            action={
              <Button onClick={() => setAsignando({ open: true, assignment: null })}>
                <Plus size={18} aria-hidden />
                Añadir asignación
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <DataTable
              caption={`Asignaciones de ${teacher.fullName}`}
              head={[{ label: "Grupo" }, { label: "Jornada" }, { label: "Materia" }, { label: "Código del grupo" }, { label: "Acciones" }]}
            >
              {teacher.assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell className="font-semibold">{assignment.group.label}</TableCell>
                  <TableCell className="text-muted">{SHIFT_LABEL[assignment.group.shift as Shift]}</TableCell>
                  <TableCell className="text-muted">{assignment.subject.name}</TableCell>
                  <TableCell className="text-muted">{assignment.group.accessCode}</TableCell>
                  <TableCell>
                    <TableActions
                      actions={[
                        { label: "Cambiar", onClick: () => setAsignando({ open: true, assignment }) },
                        { label: "Quitar", onClick: () => setAQuitar(assignment) },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
            <p className="text-meta text-muted">{assignmentsSummary(teacher)}</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-6">
        <h2 className="text-body font-semibold text-ink">Eliminar profesor</h2>
        <p className="text-meta text-muted">
          {deleteDescription(teacher)} Las guías publicadas se conservan y las materias quedan sin docente. Esta acción
          no se puede deshacer.
        </p>
        <div>
          <Button variant="secondary" onClick={() => setEliminando(true)}>
            Eliminar profesor
          </Button>
        </div>
      </section>

      <AssignmentDialog
        teacher={teacher}
        assignment={asignando.assignment}
        slots={slots}
        open={asignando.open}
        onClose={() => setAsignando({ open: false, assignment: null })}
        onSaved={guardarAsignacion}
      />

      <Dialog
        open={aQuitar !== null}
        onClose={() => {
          if (quitando) return;
          setErrorQuitar(null);
          setAQuitar(null);
        }}
        title={aQuitar ? `¿Quitar ${aQuitar.subject.name}?` : ""}
        description={
          aQuitar ? `${aQuitar.subject.name} (${aQuitar.group.label}) quedará sin docente asignado.` : undefined
        }
        actions={
          <>
            <Button
              variant="secondary"
              disabled={quitando}
              onClick={() => {
                setErrorQuitar(null);
                setAQuitar(null);
              }}
            >
              Cancelar
            </Button>
            <Button disabled={quitando} onClick={() => void confirmarQuitar()}>
              {quitando ? "Quitando…" : "Quitar asignación"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Notice title="Antes de continuar">
            Las guías publicadas de la materia se conservan; otro profesor podrá administrarlas desde la asignación.
          </Notice>
          {errorQuitar && (
            <Notice tone="error" title="No pudimos quitar la asignación">
              {errorQuitar}
            </Notice>
          )}
        </div>
      </Dialog>

      <TeacherDeleteDialog
        teacher={teacher}
        open={eliminando}
        onClose={() => setEliminando(false)}
        onDeleted={onDeleted}
      />
    </>
  );
}

/**
 * Diálogo de añadir / cambiar asignación (Figma `admin-09`, botones «Añadir
 * asignación» y «Cambiar»): selector de materia con su grupo y aviso si otra
 * persona la tenía.
 */
function AssignmentDialog({
  teacher,
  assignment,
  slots,
  open,
  onClose,
  onSaved,
}: {
  teacher: AdminTeacher;
  /** null = añadir; con valor = cambiar esa asignación. */
  assignment: TeacherAssignment | null;
  slots: SubjectSlot[];
  open: boolean;
  onClose: () => void;
  onSaved: (slotId: string) => Promise<void>;
}) {
  const [slotId, setSlotId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Al abrir se parte de la materia actual (si se cambia) y se limpia el error.
  useEffect(() => {
    if (!open) return;
    setSlotId(assignment?.subject.id ?? "");
    setError(null);
    setGuardando(false);
  }, [open, assignment]);

  const opciones = [...slots];
  if (assignment && !opciones.some((slot) => slot.id === assignment.subject.id)) {
    opciones.unshift({
      id: assignment.subject.id,
      groupId: assignment.group.id,
      name: assignment.subject.name,
      label: `${assignment.group.label} · ${SHIFT_LABEL[assignment.group.shift as Shift]} — ${assignment.subject.name}`,
    });
  }

  async function guardar() {
    if (!slotId) {
      setError("Selecciona una materia.");
      return;
    }
    if (assignment && slotId === assignment.subject.id) {
      setError("Elige una materia distinta para cambiar la asignación.");
      return;
    }
    if (teacher.assignments.some((item) => item.subject.id === slotId)) {
      setError("Esa materia ya está asignada a este profesor.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await onSaved(slotId);
    } catch (err) {
      console.warn("[WEB-06] No se pudo guardar la asignación:", err);
      setError(err instanceof Error ? err.message : "No pudimos guardar la asignación.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (guardando) return; // mientras guarda no se cierra: el resultado tiene que verse
        onClose();
      }}
      title={assignment ? "Cambiar asignación" : "Añadir asignación"}
      description={
        assignment
          ? `${firstName(teacher.fullName)} dejará de gestionar ${assignment.subject.name} en ${assignment.group.label}.`
          : `Elige la materia y el grupo que gestionará ${firstName(teacher.fullName)}.`
      }
      actions={
        <>
          <Button variant="secondary" disabled={guardando} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={guardando} onClick={() => void guardar()}>
            {guardando
              ? "Guardando…"
              : assignment
                ? "Cambiar asignación"
                : "Añadir asignación"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label="Materia y grupo *"
          hint="Si la materia ya tiene docente, este cambio la reasigna."
          value={slotId}
          error={error}
          onChange={(event) => {
            setSlotId(event.target.value);
            setError(null);
          }}
        >
          <option value="">Selecciona una materia</option>
          {opciones.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label}
            </option>
          ))}
        </Select>
        {slots.length === 0 && !assignment && (
          <Notice title="No quedan materias disponibles">
            Todas las materias de los grupos ya tienen docente. Quita alguna asignación antes de añadir otra.
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
