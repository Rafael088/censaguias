import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

let admin: SupabaseClient | undefined;
let tests: SupabaseClient | undefined;
let override: SupabaseClient | undefined;

/**
 * Cliente con service_role: salta RLS. Solo vive en la API.
 * Toda autorización se decide en los middlewares antes de llegar aquí (ADR 0003).
 */
export function supabaseAdmin(): SupabaseClient {
  if (tests) return tests;

  if (override) return override;

  admin ??= createClient(env().SUPABASE_URL, env().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
/** Solo para tests (lib/testing.ts): sustituye el cliente por el simulado en memoria. */
export function setSupabaseForTests(client: SupabaseClient | undefined): void {
  tests = client;
  if (client === undefined) admin = undefined;
}

let anonTests: SupabaseClient | undefined;

/**
 * Cliente anon para el login: uno por request, sin sesión persistida, para que
 * dos usuarios que entran a la vez no compartan la sesión (como estaba antes).
 */
export function anonClient(): SupabaseClient {
  if (anonTests) return anonTests;
  return createClient(env().SUPABASE_URL, env().SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Solo para tests (lib/testing.ts). */
export function setSupabaseAnonForTests(client: SupabaseClient | undefined): void {
  anonTests = client;
/** Solo para tests: inyecta un Supabase simulado. Pasa `undefined` para volver al real. */
export function setSupabaseForTests(client?: SupabaseClient): void {
  override = client;
}

export const GUIDES_BUCKET = "guides";
