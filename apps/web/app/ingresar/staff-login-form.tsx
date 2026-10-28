"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
import { FilterTabs, type TabOption } from "@/components/filter-tabs";
import { Notice } from "@/components/notice";
import { api } from "@/lib/api";
import { setStaffSession } from "@/lib/supabase";

// Pestañas del Figma. Sirven para elegir el espacio del que se entra; quién decide el rol es la
// base de datos, así que una pestaña equivocada no impide entrar (regla 7).
const espacios: TabOption[] = [
  { value: "teacher", label: "Profesor" },
  { value: "admin", label: "Administrador" },
];

type Vista = "form" | "error" | "restablecer";

export function StaffLoginForm() {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("form");
  const [espacio, setEspacio] = useState("teacher");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await api.v1.auth.login.$post({ json: { username, password } });
      if (!res.ok) {
        setVista("error");
        return;
      }
      const { session } = await res.json();
      await setStaffSession(session);
      // El rol sale de /v1/me; si esta sesión no es de este rol, el guard la manda a la suya.
      const me = await api.v1.me.$get();
      if (me.ok) {
        const perfil = await me.json();
        router.replace(perfil.role === "admin" ? "/admin" : "/profesor");
      } else {
        router.replace("/ingresar");
      }
    } catch {
      setVista("error");
    } finally {
      setPending(false);
    }
  }

  if (vista === "restablecer") {
    // Recuperación por correo está fuera del MVP (PLANNING): el acceso lo restablece el admin.
    return (
      <div className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-8">
        <h2 className="text-section font-semibold text-primary">¿Olvidaste tu contraseña?</h2>
        <Notice tone="info">Solicita el restablecimiento a tu administrador institucional.</Notice>
        <p className="text-meta text-muted">
          El administrador institucional puede restablecer tu acceso. No es necesario crear otra cuenta.
        </p>
        <Button variant="secondary" className="w-full" onClick={() => setVista("form")}>
          Volver al acceso institucional
        </Button>
      </div>
    );
  }

  const conError = vista === "error";

  return (
    <div className="flex flex-col gap-5 rounded-panel border border-line bg-surface p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-section font-semibold text-primary">Iniciar sesión</h1>
        {!conError && <p className="text-meta text-muted">Acceso exclusivo para personal institucional.</p>}
      </div>

      <FilterTabs label="Tipo de acceso" options={espacios} value={espacio} onChange={setEspacio} />

      {conError && (
        <Notice tone="error" title="Usuario o contraseña incorrectos">
          Verifica tus credenciales e inténtalo de nuevo. Tu sesión no se ha iniciado.
        </Notice>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="Usuario institucional"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="laura.martinez"
          autoComplete="username"
          invalid={conError}
        />
        <Field
          label="Contraseña"
          type={mostrar ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          invalid={conError}
        />
        <label className="flex items-center gap-2 text-meta text-muted">
          <input
            type="checkbox"
            checked={mostrar}
            onChange={(e) => setMostrar(e.target.checked)}
            className="size-4 accent-primary"
          />
          Mostrar contraseña
        </label>
        <Button type="submit" className="w-full" disabled={pending}>
          {!conError && <ArrowRight size={20} aria-hidden />}
          {conError ? "Reintentar inicio de sesión" : "Iniciar sesión"}
        </Button>
      </form>

      {conError ? (
        <>
          <Button variant="secondary" className="w-full" onClick={() => setVista("restablecer")}>
            Solicitar restablecimiento al administrador
          </Button>
          <p className="text-meta text-muted">
            El administrador institucional puede restablecer tu acceso. No es necesario crear otra cuenta.
          </p>
          <button
            type="button"
            onClick={() => setVista("form")}
            className="mx-auto text-label font-semibold text-primary"
          >
            Volver al acceso institucional
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setVista("restablecer")}
            className="mx-auto text-label font-semibold text-primary"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <p className="text-meta text-muted">Solicita el restablecimiento a tu administrador institucional.</p>
        </>
      )}
    </div>
  );
}
