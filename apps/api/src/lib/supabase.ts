import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

let admin: SupabaseClient | undefined;
let override: SupabaseClient | undefined;

/**
 * Cliente con service_role: salta RLS. Solo vive en la API.
 * Toda autorización se decide en los middlewares antes de llegar aquí (ADR 0003).
 */
export function supabaseAdmin(): SupabaseClient {
  if (override) return override;
  admin ??= createClient(env().SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** Solo para tests: inyecta un Supabase simulado. Pasa `undefined` para volver al real. */
export function setSupabaseForTests(client?: SupabaseClient): void {
  override = client;
}

export const GUIDES_BUCKET = "guides";
