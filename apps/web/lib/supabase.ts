import { createBrowserClient } from "@supabase/ssr";

/**
 * Sesión del staff en el navegador (ADR 0003): Supabase Auth solo guarda y refresca el token
 * que devolvió la API; el login pasa por `POST /v1/auth/login` (ADR 0006).
 *
 * El cliente se crea en el primer uso y no al importar el módulo: estas funciones corren en el
 * navegador, y estos módulos también se evalúan al hacer SSR.
 */
type BrowserClient = ReturnType<typeof createBrowserClient>;

let client: BrowserClient | undefined;

function supabase(): BrowserClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver apps/web/.env.example).");
  }
  client = createBrowserClient(url, key);
  return client;
}

/** Guarda la sesión que devolvió la API. Desde aquí supabase-js la refresca sola. */
export async function setStaffSession(tokens: { access_token: string; refresh_token: string }): Promise<void> {
  const { error } = await supabase().auth.setSession(tokens);
  if (error) throw new Error(`No se pudo guardar la sesión: ${error.message}`);
}

/**
 * Access token actual, para el Bearer de la API. Devuelve null si no hay sesión
 * (o si esto corre en el servidor: la sesión del staff vive en el navegador).
 */
export async function getAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

/** Cierra la sesión del staff: borra el token y las cookies de Supabase. */
export async function signOutStaff(): Promise<void> {
  await supabase().auth.signOut();
}
