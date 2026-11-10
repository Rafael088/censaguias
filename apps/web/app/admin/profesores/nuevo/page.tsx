"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Breadcrumb } from "@/components/breadcrumb";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { Notice } from "@/components/notice";
import {
  createTeacher,
  validateTeacherForm,
  type AdminTeacher,
  type TeacherFormErrors,
} from "@/lib/teachers";

/**
 * Registrar profesor (Figma `admin-09`, columna «Al registrar un nuevo
 * profesor»): nombre, usuario institucional y contraseña temporal, con el aviso
 * de entrega segura de credenciales. Al crearlo, la contraseña se enseña una
 * sola vez para compartirla con el docente.
 *
 * TODO(API-08): hoy guarda en la muestra de `lib/teachers.ts`; con `POST
 * /v1/teachers` solo cambia esa capa.
 */
export default function NuevoProfesor() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [errores, setErrores] = useState<TeacherFormErrors>({});
  const [errorApi, setErrorApi] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState<{ teacher: AdminTeacher; password: string } | null>(null);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { errors, input } = validateTeacherForm({ fullName, username, temporaryPassword });
    setErrores(errors);
    setErrorApi(null);
    if (!input) return;

    setGuardando(true);
    try {
      const teacher = await createTeacher(input);
      setCreado({ teacher, password: input.temporaryPassword });
    } catch (err) {
      console.warn("[WEB-06] No se pudo registrar al profesor:", err);
      setErrorApi(err instanceof Error ? err.message : "No pudimos registrar al profesor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Breadcrumb items={[{ label: "Profesores", href: "/admin/profesores" }, { label: "Nuevo profesor" }]} />

      <header className="flex flex-col gap-1">
        <h1 className="text-section font-semibold text-ink">
          {creado ? "Profesor registrado" : "Registrar profesor"}
        </h1>
        <p className="text-body text-muted">
          {creado
            ? "Comparte sus credenciales directamente con el docente."
            : "Crea el usuario institucional del docente con una contraseña temporal."}
        </p>
      </header>

      {creado ? (
        <div className="flex flex-col gap-4">
          <Notice tone="success" title="Profesor registrado correctamente">
            {creado.teacher.fullName} ya tiene usuario institucional. Comparte el usuario y la contraseña temporal
            directamente con él o ella: no se volverá a mostrar.
          </Notice>

          <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-body font-semibold text-ink">Credenciales del docente</h2>
              <p className="text-meta text-muted">
                Guárdalas en un sitio seguro para entregarlas: los estudiantes no usan estas credenciales.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-semibold text-ink">Usuario institucional</span>
                <input
                  readOnly
                  aria-label="Usuario institucional"
                  value={creado.teacher.username}
                  className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-ink"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-label font-semibold text-ink">Contraseña temporal</span>
                <input
                  readOnly
                  aria-label="Contraseña temporal"
                  value={creado.password}
                  className="min-h-[46px] w-full rounded-control border border-line bg-surface px-3 text-body text-ink"
                />
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" onClick={() => router.push("/admin/profesores")}>
                Volver a profesores
              </Button>
              <Button onClick={() => router.push(`/admin/profesores/${creado.teacher.id}`)}>
                Asignar materias
              </Button>
            </div>
          </section>
        </div>
      ) : (
        <form onSubmit={(event) => void guardar(event)} className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 lg:col-span-2">
              <h2 className="text-body font-semibold text-ink">Datos del docente</h2>
              <Field
                label="Nombre completo *"
                placeholder="Ej. Laura Martínez"
                value={fullName}
                error={errores.fullName}
                autoComplete="off"
                onChange={(event) => setFullName(event.target.value)}
              />
              <Field
                label="Usuario institucional *"
                hint="En minúsculas, sin espacios: así entra el docente al espacio profesor."
                placeholder="Ej. laura.martinez"
                value={username}
                error={errores.username}
                autoComplete="off"
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
              />
              <Field
                label="Contraseña temporal *"
                hint="Mínimo 8 caracteres. Solo se muestra aquí y al restablecerla."
                value={temporaryPassword}
                error={errores.temporaryPassword}
                autoComplete="off"
                onChange={(event) => setTemporaryPassword(event.target.value)}
              />
              <p className="text-meta text-muted">* Campos obligatorios</p>
            </section>

            <aside className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
              <h2 className="text-body font-semibold text-ink">Entrega segura de credenciales</h2>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-meta text-muted">
                <li>Registra al docente con su nombre y usuario institucional.</li>
                <li>Comparte el usuario y la contraseña temporal directamente con él o ella.</li>
                <li>Asígnale materias desde el detalle del profesor.</li>
              </ol>
              <Notice title="Nunca en el aula">
                Los estudiantes no usan estas credenciales: entran con el código de su grupo.
              </Notice>
            </aside>
          </div>

          {errorApi && (
            <Notice tone="error" title="No pudimos registrar al profesor">
              {errorApi}
            </Notice>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" disabled={guardando} onClick={() => router.push("/admin/profesores")}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando}>
              <Plus size={18} aria-hidden />
              {guardando ? "Registrando…" : "Registrar profesor"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
