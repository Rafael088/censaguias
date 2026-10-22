import type { SupabaseClient } from "@supabase/supabase-js";
import { setSupabaseForTests } from "./supabase.js";
import { signStudentSession, STUDENT_COOKIE } from "./student-session.js";

// Variables por defecto ANTES de que env() las lea (se cachean en el primer uso).
// Así los tests corren sin .env: el cliente real nunca se crea, manda el simulado.
process.env.SUPABASE_URL ??= "http://supabase.test";
process.env.SUPABASE_ANON_KEY ??= "anon-de-pruebas";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-de-pruebas";
process.env.STUDENT_SESSION_SECRET ??= "secreto-de-pruebas-de-al-menos-32-caracteres";

/** Fila de tabla simulada; los nombres de columna son los de la migración (snake_case). */
export type Row = Record<string, unknown>;

export type Seed = {
  profiles?: Row[];
  groups?: Row[];
  subjects?: Row[];
  guides?: Row[];
};

type QueryResult = { data: unknown; error: { message: string } | null };

/**
 * Cadena mínima de supabase-js: select/eq + single/maybeSingle, y espera como array.
 * `select` ignora la lista de columnas y devuelve la fila entera; cada test mira lo que le importa.
 */
class FakeQuery {
  private filters: [string, unknown][] = [];

  constructor(private readonly rows: Row[]) {}

  select(_columns = "*"): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  private matched(): Row[] {
    return this.rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
  }

  /** Igual que supabase-js: una fila, ni cero ni varias. */
  single(): Promise<QueryResult> {
    const rows = this.matched();
    if (rows.length === 1) return Promise.resolve({ data: rows[0], error: null });
    return Promise.resolve({ data: null, error: { message: `single: ${rows.length} filas` } });
  }

  maybeSingle(): Promise<QueryResult> {
    const rows = this.matched();
    if (rows.length > 1) return Promise.resolve({ data: null, error: { message: `maybeSingle: ${rows.length} filas` } });
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  // Esperable como array: `await db.from("subjects").select().eq("teacher_id", id)`.
  then: PromiseLike<Row[]>["then"] = (onFulfilled, onRejected) =>
    Promise.resolve(this.matched()).then(onFulfilled, onRejected);
}

export type FakeSupabase = {
  /** Cliente para setSupabaseForTests (ya instalado al crear). */
  client: SupabaseClient;
  /** Filas sembradas; mutables desde el test (p. ej. desactivar un profesor a mitad). */
  profiles: Row[];
  groups: Row[];
  subjects: Row[];
  guides: Row[];
  /** Bearer de staff con el perfil dado. Lanza si el perfil no está en el seed. */
  staffSession(profileId: string): { headers: Record<string, string> };
  /** Cookie de estudiante firmada con la clave de pruebas; usa el code_version del grupo sembrado. */
  studentSession(groupId: string, codeVersion?: number): Promise<{ headers: Record<string, string> }>;
  /** Vuelve al cliente real (afterAll). */
  restore(): void;
};

/**
 * Supabase simulado en memoria para los tests de la API.
 * Cubre lo que la API usa hoy: from/select/eq/single/maybeSingle y auth.getUser.
 * Las siguientes tareas amplían esta clase al necesitar más (insert, delete, storage…).
 */
export function fakeSupabase(seed: Seed = {}): FakeSupabase {
  const profiles = seed.profiles ?? [];
  const groups = seed.groups ?? [];
  const subjects = seed.subjects ?? [];
  const guides = seed.guides ?? [];
  const tables: Record<string, Row[]> = { profiles, groups, subjects, guides };

  // token de acceso falso → id de usuario (lo que Supabase Auth haría de verdad).
  const tokens = new Map<string, string>();
  let tokenCount = 0;

  // El cast es porque supabase-js tipa un cliente completo que no vamos a reimplementar:
  // el simulador solo cubre los métodos que la API usa, y eso basta para probarla.
  const client = {
    from(table: string) {
      const rows = tables[table];
      if (!rows) throw new Error(`Tabla «${table}» no está en el simulador; añádela en Seed.`);
      return new FakeQuery(rows);
    },
    auth: {
      getUser(token: string): Promise<QueryResult> {
        const userId = tokens.get(token);
        return Promise.resolve(
          userId ? { data: { user: { id: userId } }, error: null } : { data: { user: null }, error: { message: "token inválido" } },
        );
      },
    },
  } as unknown as SupabaseClient;

  setSupabaseForTests(client);

  return {
    client,
    profiles,
    groups,
    subjects,
    guides,
    staffSession(profileId) {
      const profile = profiles.find((row) => row.id === profileId);
      if (!profile) throw new Error(`staffSession: el perfil «${profileId}» no está en el seed.`);
      const token = `token-falso-${++tokenCount}`;
      tokens.set(token, profileId);
      return { headers: { Authorization: `Bearer ${token}` } };
    },
    async studentSession(groupId, codeVersion = 1) {
      const group = groups.find((row) => row.id === groupId);
      const version = typeof group?.code_version === "number" ? group.code_version : codeVersion;
      const token = await signStudentSession({ groupId, codeVersion: version });
      return { headers: { Cookie: `${STUDENT_COOKIE}=${token}` } };
    },
    restore() {
      setSupabaseForTests(undefined);
    },
  };
}
