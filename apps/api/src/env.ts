import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STUDENT_SESSION_SECRET: z.string().min(32),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Se lee en el primer uso, no al importar, para que los tests no necesiten un .env. */
export function env(): Env {
  cached ??= envSchema.parse(process.env);
  return cached;
}
