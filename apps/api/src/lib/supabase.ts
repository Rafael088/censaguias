import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env.js";

let admin: SupabaseClient | undefined;
let tests: SupabaseClient | undefined;

/**
 * Cliente con service_role: salta RLS. Solo vive en la API.
 * Toda autorización se decide en los middlewares antes de llegar aquí (ADR 0003).
 */
export function supabaseAdmin(): SupabaseClient {
  if (tests) return tests;
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

export const GUIDES_BUCKET = "guides";
