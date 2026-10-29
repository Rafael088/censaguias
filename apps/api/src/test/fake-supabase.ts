import type { SupabaseClient } from "@supabase/supabase-js";

/** Fila en memoria, como la devolvería Postgres. */
export type Row = Record<string, unknown>;

/**
 * Datos que la API leería en Supabase. Todo vive en memoria: los tests no salen a la red
 * ni necesitan proyecto ni credenciales.
 */
export type FakeData = {
  profiles: Row[];
  groups: Row[];
  subjects: Row[];
  guides: Row[];
  /** access_token → id de usuario en auth; es lo que resuelve `auth.getUser(token)`. */
  authTokens: Record<string, string>;
};

export type QueryError = { message: string };
export type QueryResult = { data: unknown; error: QueryError | null };

/** Builder encadenable: `await db.from("x").select().eq(...)` y `.single()`. */
class FakeSelect implements PromiseLike<QueryResult> {
  private rows: Row[];
  private mode: "many" | "one" | "maybe" = "many";

  constructor(rows: Row[]) {
    this.rows = [...rows]; // copia: filtrar no debe tocar los datos sembrados
  }

  eq(column: string, value: unknown): this {
    this.rows = this.rows.filter((row) => row[column] === value);
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.rows = this.rows.filter((row) => values.includes(row[column]));
    return this;
  }

  /** Ordena columnas de texto (nombre, tema…); los nulos van al final. */
  order(column: string, options?: { ascending?: boolean }): this {
    const factor = options?.ascending === false ? -1 : 1;
    this.rows = [...this.rows].sort((a, b) => {
      const left = a[column];
      const right = b[column];
      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;
      return String(left).localeCompare(String(right), "es") * factor;
    });
    return this;
  }

  /** Una fila o error si no hay exactamente una (como PostgREST). */
  single(): this {
    this.mode = "one";
    return this;
  }

  /** Una fila o `null`, sin quejarse si no hay ninguna. */
  maybeSingle(): this {
    this.mode = "maybe";
    return this;
  }

  private finish(): QueryResult {
    if (this.mode === "many") return { data: this.rows, error: null };
    if (this.rows.length > 1) {
      return { data: null, error: { message: `se esperaba una fila y hay ${this.rows.length}` } };
    }
    const row = this.rows[0] ?? null;
    if (this.mode === "maybe") return { data: row, error: null };
    if (!row) return { data: null, error: { message: "no hay filas" } };
    return { data: row, error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.finish()).then(onfulfilled, onrejected);
  }
}

/** Se ignoran las columnas proyectadas: los tests comprueban campos, no la proyección. */
class FakeTable {
  constructor(private readonly rows: Row[]) {}

  select(_columns = "*"): FakeSelect {
    return new FakeSelect(this.rows);
  }
}

class FakeDb {
  constructor(private readonly data: FakeData) {}

  readonly auth = {
    getUser: async (token: string) => {
      const id = this.data.authTokens[token];
      if (!id) return { data: { user: null }, error: { message: "token inválido" } };
      return { data: { user: { id } }, error: null };
    },
  };

  from(table: string): FakeTable {
    switch (table) {
      case "profiles":
        return new FakeTable(this.data.profiles);
      case "groups":
        return new FakeTable(this.data.groups);
      case "subjects":
        return new FakeTable(this.data.subjects);
      case "guides":
        return new FakeTable(this.data.guides);
      default:
        // Falla en alto: mejor un error de test que seguir con una tabla vacía.
        throw new Error(`el supabase simulado no conoce la tabla "${table}"`);
    }
  }
}

/**
 * Cliente simulado con solo los métodos que hoy usa la API (`auth.getUser` y
 * `from().select()` con filtros). El cast es imprescindible: `SupabaseClient` declara
 * además storage, realtime y rpc, que esta API todavía no toca.
 */
export function createFakeSupabase(data: FakeData): SupabaseClient {
  return new FakeDb(data) as unknown as SupabaseClient;
}
