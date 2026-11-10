"use client";

import { Plus, Trash2, Edit3, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { CodeChip } from "@/components/code-chip";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import { Select } from "@/components/select";
import { EmptyState } from "@/components/empty-state";
import { ErrorScreen, LoadingScreen } from "@/components/screen-state";
import {
  NoStaffSession,
  assignSubjectTeacher,
  createSubject,
  deleteSubject,
  getGroup,
  listSubjects,
  listTeachers,
  type SubjectDetail,
  type TeacherOption,
  updateSubject,
  validateSubjectForm,
} from "@/lib/admin";

/** Detalle de grupo (Figma `admin-05`): código con copiar, tabla de materias y docentes,
 *  crear materia, editar nombre/descripción, cambiar docente y eliminar materia.
 */
export default function AdminGrupoDetalle() {
  const router = useRouter();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) router.replace("/admin/grupos");
  // Next 15 ya no expone params en page props de cliente sin getServerSideProps;
  // leemos el id de la URL. Las rutas dinámicas de Next 16 sí lo inyectan, pero aquí
  // usamos searchParams para no romper la compilación.

  const [group, setGroup] = useState<{ id: string; label: string; accessCode: string } | null>(null);
  const [subjects, setSubjects] = useState<SubjectDetail[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [intento, setIntento] = useState(0);

  // Crear materia
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [erroresForm, setErroresForm] = useState<{ name?: string; teacherId?: string }>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Editar materia
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Cambiar docente
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);
  const [nuevoTeacherId, setNuevoTeacherId] = useState("");
  const [guardandoCambio, setGuardandoCambio] = useState(false);

  // Eliminar materia
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [guardandoEliminacion, setGuardandoEliminacion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEstado("cargando");
    Promise.all([cargarGrupo(), cargarMaterias(), cargarProfesores()])
      .then(() => {
        if (!cancelled) setEstado("listo");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof NoStaffSession) {
          router.replace("/ingresar");
          return;
        }
        console.warn("[WEB-05] No se pudo cargar el detalle del grupo:", error);
        setEstado("error");
      });
    return () => {
      cancelled = true;
    };
  }, [intento, router, id]);

  async function cargarGrupo() {
    const g = await getGroup(id!);
    if (g) {
      setGroup({ id: g.id, label: g.label, accessCode: g.accessCode });
    } else {
      throw new Error("Grupo no encontrado");
    }
  }

  async function cargarMaterias() {
    const items = await listSubjects(id!);
    setSubjects(items);
  }

  async function cargarProfesores() {
    const items = await listTeachers();
    setTeachers(items);
  }

  function reiniciarFormulario() {
    setNombre("");
    setDescripcion("");
    setTeacherId("");
    setErroresForm({});
    setErrorApi(null);
    setCreando(false);
  }

  async function guardarMateria(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors, input } = validateSubjectForm({ name: nombre, description: descripcion, teacherId }, teachers);
    setErroresForm(errors);
    setErrorApi(null);
    if (!input) return;

    setGuardando(true);
    try {
      await createSubject(id!, input);
      reiniciarFormulario();
      setIntento((n) => n + 1);
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-05] No se pudo crear la materia:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos crear la materia.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(subjectId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = editNombre.trim();
    const description = editDescripcion.trim() || null;
    if (!name) return;

    setGuardandoEdicion(true);
    try {
      await updateSubject(subjectId, { name, description });
      setEditandoId(null);
      setIntento((n) => n + 1);
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-05] No se pudo editar la materia:", err);
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function asignarDocente(subjectId: string) {
    const teacherId = nuevoTeacherId || null;
    setGuardandoCambio(true);
    try {
      await assignSubjectTeacher(subjectId, teacherId);
      setCambiandoId(null);
      setNuevoTeacherId("");
      setIntento((n) => n + 1);
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-05] No se pudo asignar el docente:", err);
    } finally {
      setGuardandoCambio(false);
    }
  }

  async function eliminarMateria(subjectId: string) {
    setGuardandoEliminacion(true);
    try {
      await deleteSubject(subjectId);
      setEliminandoId(null);
      setIntento((n) => n + 1);
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-05] No se pudo eliminar la materia:", err);
    } finally {
      setGuardandoEliminacion(false);
    }
  }

  if (estado === "cargando") return <LoadingScreen text="Cargando el grupo…" />;
  if (estado === "error" || !group) {
    return (
      <ErrorScreen onRetry={() => setIntento((n) => n + 1)}>
        No pudimos cargar el grupo.
      </ErrorScreen>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Breadcrumb items={[{ label: "Grupos CLEI", href: "/admin/grupos" }, { label: group.label }]} />

      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">{group.label}</h1>
        <p className="text-body text-muted">Materias y docentes de este grupo.</p>
      </header>

      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-body font-semibold text-ink">Código de acceso</h2>
          <p className="text-meta text-muted">
            Compártelo con los estudiantes del grupo. Es único y no se reutiliza en otros grupos ni jornadas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-label font-semibold text-ink">Código del grupo</p>
          <CodeChip code={group.accessCode} />
        </div>
      </section>

      {errorApi && (
        <Notice tone="error" title="No pudimos crear la materia">
          {errorApi}
        </Notice>
      )}

      {creando ? (
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <h2 className="text-body font-semibold text-ink">Crear materia</h2>
          <form onSubmit={(event) => void guardarMateria(event)} className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Nombre de la materia *"
                value={nombre}
                error={erroresForm.name}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Ej. Matemáticas"
              />
              <Select
                label="Docente *"
                value={teacherId}
                error={erroresForm.teacherId}
                onChange={(event) => setTeacherId(event.target.value)}
              >
                <option value="">Selecciona un profesor</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <span className="text-label font-semibold text-ink">Descripción</span>
                <textarea
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  placeholder="Descripción opcional de la materia"
                  className="min-h-[100px] w-full rounded-control border border-line bg-surface px-3 py-3 text-body text-ink outline-none focus:border-2 focus:border-primary resize-none"
                />
              </div>
            </div>
            <p className="text-meta text-muted">* Campos obligatorios</p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" type="button" disabled={guardando} onClick={reiniciarFormulario}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                <Plus size={18} aria-hidden />
                {guardando ? "Creando…" : "Crear materia"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-body font-semibold text-ink">Materias y docentes</h2>
            <p className="text-meta text-muted">
              {subjects.length} {subjects.length === 1 ? "materia" : "materias"} asignadas a este grupo.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setCreando(true)}
            disabled={guardando || creando}
          >
            <Plus size={18} aria-hidden />
            Crear materia
          </Button>
        </div>

        {subjects.length === 0 ? (
          <EmptyState
            title="Todavía no hay materias"
            description="Crea la primera materia y asigna un docente registrado para que los estudiantes vean sus guías publicadas."
            action={
              <Button type="button" onClick={() => setCreando(true)} disabled={guardando || creando}>
                <Plus size={18} aria-hidden />
                Crear primera materia
              </Button>
            }
          />
        ) : (
          <DataTable
            caption="Materias del grupo"
            head={[
              { label: "Materia" },
              { label: "Docente" },
              { label: "Guías publicadas" },
              { label: "Acciones" },
            ]}
          >
            {subjects.map((subject) => {
              const enEdicion = editandoId === subject.id;
              const enCambio = cambiandoId === subject.id;
              const enEliminacion = eliminandoId === subject.id;
              return (
                <TableRow key={subject.id}>
                  <TableCell className="font-semibold text-ink">
                    {enEdicion ? (
                      <form onSubmit={(event) => void guardarEdicion(subject.id, event)} className="flex flex-col gap-2">
                        <input
                          defaultValue={subject.name}
                          className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-ink outline-none focus:border-2 focus:border-primary"
                          onChange={(event) => setEditNombre(event.target.value)}
                        />
                        <textarea
                          defaultValue={subject.description ?? ""}
                          className="min-h-[80px] w-full rounded-control border border-line bg-surface px-3 py-3 text-body text-ink outline-none focus:border-2 focus:border-primary resize-none"
                          onChange={(event) => setEditDescripcion(event.target.value)}
                        />
                        <div className="flex items-end justify-end gap-2">
                          <Button variant="secondary" type="button" size="sm" disabled={guardandoEdicion} onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                          <Button type="submit" size="sm" disabled={guardandoEdicion}>
                            Guardar
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span className="font-semibold">{subject.name}</span>
                        {subject.description && (
                          <p className="text-meta text-muted">{subject.description}</p>
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    {enCambio ? (
                      <Select
                        label="Docente"
                        value={nuevoTeacherId}
                        onChange={(event) => setNuevoTeacherId(event.target.value)}
                      >
                        <option value="">Selecciona un profesor</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span>
                        {subject.teacher ? (
                          <>
                            <User size={16} className="mr-1.5 shrink-0 text-muted" aria-hidden />
                            {subject.teacher.fullName}
                          </>
                        ) : (
                          <span className="text-muted">Sin docente asignado</span>
                        )}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted">
                    {subject.publishedGuides} {subject.publishedGuides === 1 ? "guía" : "guías"}
                  </TableCell>
                  <TableCell>
                    <TableActions
                      actions={[
                        {
                          label: enEdicion ? "Guardar" : "Editar",
                          onClick: () => {
                            if (enEdicion) {
                              // El formulario se envía con Guardar
                            } else {
                              setEditNombre(subject.name);
                              setEditDescripcion(subject.description ?? "");
                              setEditandoId(subject.id);
                            }
                          },
                        },
                        {
                          label: enCambio ? "Asignar" : "Cambiar docente",
                          onClick: () => {
                            if (enCambio) {
                              void asignarDocente(subject.id);
                            } else {
                              setCambiandoId(subject.id);
                              setNuevoTeacherId(subject.teacher?.id ?? "");
                            }
                          },
                        },
                        {
                          label: enEliminacion ? "Eliminando…" : "Eliminar",
                          onClick: () => {
                            if (enEliminacion) {
                              void eliminarMateria(subject.id);
                            } else {
                              setEliminandoId(subject.id);
                            }
                          },
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </DataTable>
        )}
      </section>
    </div>
  );
}
