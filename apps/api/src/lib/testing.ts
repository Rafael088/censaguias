import type { SupabaseClient } from "@supabase/supabase-js";
import { setSupabaseAnonForTests, setSupabaseForTests } from "./supabase.js";
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
  /** Credenciales de login simuladas: correo → contraseña (para auth.signInWithPassword). */
  logins?: Record<string, string>;
  /** Archivos del bucket, por nombre de bucket: rutas completas como "{groupId}/{subjectId}/{guideId}.pdf". */
  storage?: Record<string, string[]>;
};

/**
 * Error de PostgREST simulado. `code` reproduce los códigos reales:
 * "23505" = violación de unique (p. ej. un código de acceso ya usado).
 */
export type FakeError = { message: string; code?: string | null; details?: string; hint?: string };

/** Forma real de la respuesta de supabase-js (select/insert/update/delete, con o sin .single()). */
type QueryResult = {
  data: unknown;
  error: FakeError | null;
  count: number | null;
  status: number;
  statusText: string;
  success: boolean;
};

const ok = (data: unknown, count: number | null = null): QueryResult => ({
  data,
  error: null,
  count,
  status: 200,
  statusText: "OK",
  success: true,
});

const failed = (error: FakeError): QueryResult => ({
  data: null,
  error,
  count: null,
  status: error.code === "23505" ? 409 : 400,
  statusText: "Bad Request",
  success: false,
});

type Filter = { column: string; op: "eq" | "neq" | "ilike" | "in"; value: unknown };
type Kind = "select" | "insert" | "update" | "delete";

type SelectOptions = { count?: "exact" | "estimated" | "none"; head?: boolean };

function matchesLike(value: unknown, pattern: string): boolean {
  if (typeof value !== "string") return false;
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern.charAt(i);
    if (ch === "\\" && i + 1 < pattern.length) {
      source += pattern.charAt(++i).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (ch === "%") source += ".*";
    else if (ch === "_") source += ".";
    else source += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`, "i").test(value);
}

const uuid = (): string =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

/**
 * Cadena de supabase-js que usa la API: from/select/insert/update/delete,
 * eq/neq/ilike/in/or, order/range/limit, count, single/maybeSingle.
 * `select` ignora la lista de columnas y devuelve la fila entera; cada test mira lo que le importa.
 */
class FakeQuery {
  private kind: Kind = "select";
  private payload: Row | Row[] | null = null;
  private countMode = false;
  private head = false;
  // Los campos no se llaman como los métodos (single/order/range): si no, la propiedad
  // tapa al método del prototipo y `await builder.single()` revienta en tiempo de ejecución.
  private singleMode: "single" | "maybe" | null = null;
  private filters: Filter[] = [];
  private orGroups: Filter[][] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private pageRange: { from: number; to: number } | null = null;
  private limitN: number | null = null;

  constructor(
    private readonly db: FakeState,
    private readonly table: string,
  ) {}

  select(_columns = "*", options?: SelectOptions): this {
    this.countMode = options?.count === "exact" || options?.count === "estimated";
    this.head = options?.head === true;
    return this;
  }

  insert(values: Row | Row[]): this {
    this.kind = "insert";
    this.payload = values;
    return this;
  }

  update(values: Row): this {
    this.kind = "update";
    this.payload = values;
    return this;
  }

  delete(): this {
    this.kind = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ column, op: "neq", value });
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.filters.push({ column, op: "ilike", value: pattern });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, op: "in", value: values });
    return this;
  }

  /** Condición OR de PostgREST: "a.ilike.%x%,b.eq.4". Las comas dentro de `q` se quitan en la ruta. */
  or(expression: string): this {
    const group: Filter[] = expression.split(",").map((part) => {
      const first = part.indexOf(".");
      const second = part.indexOf(".", first + 1);
      return {
        column: part.slice(0, first),
        op: part.slice(first + 1, second) as Filter["op"],
        value: part.slice(second + 1),
      };
    });
    this.orGroups.push(group);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  range(from: number, to: number): this {
    this.pageRange = { from, to };
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  private matchOne(row: Row, filter: Filter): boolean {
    const value = row[filter.column];
    switch (filter.op) {
      case "eq":
        // PostgREST convierte el valor al tipo de la columna: `clei.eq.4` también casa con 4.
        return typeof value === "number" ? Number(filter.value) === value : value === filter.value;
      case "neq":
        return typeof value === "number" ? Number(filter.value) !== value : value !== filter.value;
      case "ilike":
        return matchesLike(value, filter.value as string);
      case "in":
        return Array.isArray(filter.value) && filter.value.includes(value);
    }
  }

  private matched(rows: Row[]): Row[] {
    return rows.filter(
      (row) =>
        this.filters.every((filter) => this.matchOne(row, filter)) &&
        this.orGroups.every((group) => group.some((filter) => this.matchOne(row, filter))),
    );
  }

  private sorted(rows: Row[]): Row[] {
    if (!this.orderBy) return rows;
    const { column, ascending } = this.orderBy;
    const factor = ascending ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = a[column];
      const right = b[column];
      // Los nulos quedan al final, como en PostgREST.
      if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
      const cmp =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "es");
      return cmp * factor;
    });
  }

  private page(rows: Row[]): Row[] {
    let out = rows;
    if (this.pageRange) out = out.slice(this.pageRange.from, this.pageRange.to + 1);
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  /** Inyecta el error de la cola de la tabla (ver withError) si le toca esta operación. */
  private injected(): FakeError | null {
    const queue = this.db.errors[this.table];
    if (!queue) return null;
    const index = queue.findIndex((entry) => !entry.op || entry.op === this.kind);
    return index === -1 ? null : (queue.splice(index, 1)[0] as QueuedError).error;
  }

  private exec(): QueryResult {
    const injected = this.injected();
    if (injected) return failed(injected);

    const table = this.db.tables[this.table];
    if (!table) throw new Error(`Tabla «${this.table}» no está en el simulador; añádela en Seed.`);

    if (this.kind === "insert") {
      const values = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const now = new Date().toISOString();
      const inserted = values.map((value) => ({
        id: uuid(),
        created_at: now,
        ...value,
      }));
      table.push(...inserted);
      return ok(this.singleMode ? inserted[0] ?? null : inserted);
    }

    const matched = this.matched(table);

    if (this.kind === "update") {
      const values = (this.payload ?? {}) as Row;
      for (const row of matched) Object.assign(row, values);
      return ok(this.singleMode ? matched[0] ?? null : matched);
    }

    if (this.kind === "delete") {
      for (const row of matched) {
        const index = table.indexOf(row);
        if (index >= 0) table.splice(index, 1);
      }
      return ok(this.singleMode ? matched[0] ?? null : matched);
    }

    const total = this.countMode ? matched.length : null;
    const rows = this.page(this.sorted(matched));

    if (this.singleMode === "single") {
      if (rows.length !== 1) {
        return failed({
          message: `JSON object requested, multiple (or no) rows returned (${rows.length})`,
          code: "PGRST116",
        });
      }
      return ok(rows[0], total);
    }
    if (this.singleMode === "maybe") {
      if (rows.length > 1) {
        return failed({
          message: `JSON object requested, multiple rows returned (${rows.length})`,
          code: "PGRST116",
        });
      }
      return ok(rows[0] ?? null, total);
    }
    return ok(this.head ? null : rows, total);
  }

  /** Como supabase-js: la promesa resuelve la forma real { data, error, count, … }. */
  then: PromiseLike<QueryResult>["then"] = (onFulfilled, onRejected) =>
    Promise.resolve(this.exec()).then(onFulfilled, onRejected);

  single(): Promise<QueryResult> {
    this.singleMode = "single";
    return Promise.resolve(this.exec());
  }

  maybeSingle(): Promise<QueryResult> {
    this.singleMode = "maybe";
    return Promise.resolve(this.exec());
  }
}

type FakeState = {
  tables: Record<string, Row[]>;
  /** Errores en cola por tabla: se consumen uno por consulta (ver withError). */
  errors: Record<string, QueuedError[]>;
  /** Archivos por bucket, como rutas completas. */
  files: Record<string, string[]>;
  /** Errores en cola por bucket+operación ("list" | "remove"). */
  storageErrors: Record<string, FakeError[]>;
  /** Rutas que remove() ha borrado, para que el test las compruebe. */
  removed: string[];
};

/** Error esperado por un test; `op` lo limita a ese tipo de consulta. */
type QueuedError = { error: FakeError; op?: "select" | "insert" | "update" | "delete" };

export type FakeSupabase = {
  /** Cliente para setSupabaseForTests (ya instalado al crear). */
  client: SupabaseClient;
  /** Filas sembradas; mutables desde el test (p. ej. desactivar un profesor a mitad). */
  profiles: Row[];
  groups: Row[];
  subjects: Row[];
  guides: Row[];
  /** Archivos del bucket "guides" (rutas completas), mutables desde el test. */
  files: string[];
  /** Rutas que la API ha borrado de Storage, para comprobar el DELETE. */
  removed: string[];
  /**
   * Pone un error en cola para la tabla. Se consume en la próxima consulta, o en la próxima
   * de ese tipo si se da `op` (así un test puede tumbar un `update` sin romper la lectura
   * previa). `times` = cuántas veces se repite.
   */
  withError(table: string, error: FakeError, options?: { times?: number; op?: "select" | "insert" | "update" | "delete" }): void;
  /** Igual que withError pero para Storage: bucket + "list" | "upload" | "remove". */
  withStorageError(bucket: string, operation: "list" | "upload" | "remove", error: FakeError, times?: number): void;
  /** Bearer de staff con el perfil dado. Lanza si el perfil no está en el seed. */
  staffSession(profileId: string): { headers: Record<string, string> };
  /** Cookie de estudiante firmada con la clave de pruebas; usa el code_version del grupo sembrado. */
  studentSession(groupId: string, codeVersion?: number): Promise<{ headers: Record<string, string> }>;
  /** Vuelve al cliente real (afterAll). */
  restore(): void;
};

/**
 * Supabase simulado en memoria para los tests de la API.
 * Cubre lo que la API usa: from/select/insert/update/delete con filtros, paginación,
 * count, single, storage.list/upload/remove y auth.getUser. Las consultas resuelven la forma
 * real de supabase-js ({ data, error, count, … }), así que la ruta escribe igual
 * contra el simulado y contra Supabase de verdad.
 */
export function fakeSupabase(seed: Seed = {}): FakeSupabase {
  const profiles = seed.profiles ?? [];
  const groups = seed.groups ?? [];
  const subjects = seed.subjects ?? [];
  const guides = seed.guides ?? [];
  const files = { ...(seed.storage ?? {}) };

  const state: FakeState = {
    tables: { profiles, groups, subjects, guides },
    errors: {},
    files,
    storageErrors: {},
    removed: [],
  };

  // token de acceso falso → id de usuario (lo que Supabase Auth haría de verdad).
  const tokens = new Map<string, string>();
  let tokenCount = 0;

  const listFolder = (bucket: string, path?: string) => {
    const prefix = path ? `${path}/` : "";
    const entries = new Map<string, { name: string; id: string | null; metadata: Record<string, unknown> | null }>();
    for (const file of state.files[bucket] ?? []) {
      if (!file.startsWith(prefix)) continue;
      const rest = file.slice(prefix.length);
      if (rest === "") continue;
      const slash = rest.indexOf("/");
      if (slash === -1) {
        entries.set(rest, {
          name: rest,
          id: uuid(),
          metadata: { mimetype: "application/pdf", size: 1024 },
        });
      } else {
        // Subcarpeta (p. ej. el id de la materia): la lista Storage la muestra como carpeta.
        const folder = rest.slice(0, slash);
        if (!entries.has(folder)) entries.set(folder, { name: folder, id: null, metadata: null });
      }
    }
    return [...entries.values()];
  };

  const takeStorageError = (bucket: string, operation: string): FakeError | null => {
    const queue = state.storageErrors[`${bucket}:${operation}`];
    return queue && queue.length > 0 ? (queue.shift() as FakeError) : null;
  };

  // El cast es porque supabase-js tipa un cliente completo que no vamos a reimplementar:
  // el simulador solo cubre los métodos que la API usa, y eso basta para probarla.
  const client = {
    from(table: string) {
      if (!state.tables[table]) throw new Error(`Tabla «${table}» no está en el simulador; añádela en Seed.`);
      return new FakeQuery(state, table);
    },
    storage: {
      from(bucket: string) {
        state.files[bucket] ??= [];
        return {
          async upload(path: string, _body: unknown, _options?: { contentType?: string }) {
            const error = takeStorageError(bucket, "upload");
            if (error) return { data: null, error };
            const bucketFiles = (state.files[bucket] ??= []);
            if (!bucketFiles.includes(path)) bucketFiles.push(path);
            return { data: { path }, error: null };
          },
          async list(path?: string, options?: { limit?: number; offset?: number }) {
            const error = takeStorageError(bucket, "list");
            if (error) return { data: null, error };
            const offset = options?.offset ?? 0;
            const limit = options?.limit ?? 100;
            return { data: listFolder(bucket, path).slice(offset, offset + limit), error: null };
          },
          async remove(paths: string[]) {
            const error = takeStorageError(bucket, "remove");
            if (error) return { data: null, error };
            const bucketFiles = (state.files[bucket] ??= []);
            for (const path of paths) {
              state.removed.push(path);
              const index = bucketFiles.indexOf(path);
              if (index >= 0) bucketFiles.splice(index, 1);
            }
            return { data: paths.map((path) => ({ name: path.split("/").pop() ?? path })), error: null };
          },
        };
      },
    },
    auth: {
      getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: FakeError | null }> {
        const userId = tokens.get(token);
        return Promise.resolve(
          userId
            ? { data: { user: { id: userId } }, error: null }
            : { data: { user: null }, error: { message: "token inválido" } },
        );
      },
      // Igual que supabase-js: si el correo o la contraseña no cuadran, error y sesión vacía.
      signInWithPassword({ email, password }: { email: string; password: string }): Promise<{
        data: { session: { access_token: string; refresh_token: string } | null };
        error: FakeError | null;
      }> {
        if (seed.logins?.[email] !== password) {
          return Promise.resolve({ data: { session: null }, error: { message: "Invalid login credentials" } });
        }
        const token = `token-falso-${++tokenCount}`;
        tokens.set(token, email);
        return Promise.resolve({
          data: { session: { access_token: token, refresh_token: `refresh-${token}` } },
          error: null,
        });
      },
    },
  } as unknown as SupabaseClient;

  setSupabaseForTests(client);
  setSupabaseAnonForTests(client);

  return {
    client,
    profiles,
    groups,
    subjects,
    guides,
    files: state.files.guides ?? [],
    removed: state.removed,
    withError(table, error, options = {}) {
      const { times = 1, op } = options;
      state.errors[table] ??= [];
      for (let i = 0; i < times; i++) state.errors[table].push(op ? { error, op } : { error });
    },
    withStorageError(bucket, operation, error, times = 1) {
      const key = `${bucket}:${operation}`;
      state.storageErrors[key] ??= [];
      for (let i = 0; i < times; i++) state.storageErrors[key].push(error);
    },
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
      setSupabaseAnonForTests(undefined);
    },
  };
}
