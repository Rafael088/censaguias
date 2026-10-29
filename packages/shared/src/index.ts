import { z } from "zod";

// ---------- Grupos CLEI ----------

export const shiftSchema = z.enum(["morning", "night", "saturday"]);
export type Shift = z.infer<typeof shiftSchema>;

export const SHIFT_LABEL: Record<Shift, string> = { morning: "Mañana", night: "Noche", saturday: "Sabatina" };
const SHIFT_LETTER: Record<Shift, string> = { morning: "M", night: "N", saturday: "S" };

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
/** "CLEI IV · A" */
export const groupLabel = (g: { clei: number; identifier: string }) => `CLEI ${ROMAN[g.clei]} · ${g.identifier}`;

// ---------- Código de acceso (ADR 0004) ----------

// Sufijo aleatorio sin caracteres ambiguos (sin 0/O, 1/I/L).
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_SUFFIX_LENGTH = 3;
export const ACCESS_CODE_REGEX = /^CENSA-[1-6][A-Z][MNS]-[A-HJKMNP-Z2-9]{3}$/;

/** Parte legible del código: CENSA-4AM (CLEI IV, grupo A, Mañana). */
export function accessCodePrefix(g: { clei: number; identifier: string; shift: Shift }): string {
  return `CENSA-${g.clei}${g.identifier}${SHIFT_LETTER[g.shift]}`;
}

/**
 * El estudiante solo necesita sus 6 caracteres: "4amk7q", "4AM K7Q", "censa-4am-k7q"… → "CENSA-4AM-K7Q".
 * Si no tiene 6 caracteres útiles, se devuelve tal cual y la validación lo rechaza.
 */
export function normalizeAccessCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^CENSA/, "");
  return raw.length === 6 ? `CENSA-${raw.slice(0, 3)}-${raw.slice(3)}` : input.trim().toUpperCase();
}

export const accessCodeInput = z.object({
  code: z.string().transform(normalizeAccessCode).pipe(z.string().regex(ACCESS_CODE_REGEX)),
});

// ---------- Staff ----------

export const roleSchema = z.enum(["admin", "teacher"]);
export type Role = z.infer<typeof roleSchema>;

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,40}$/);

export const loginInput = z.object({ username: usernameSchema, password: z.string().min(1) });

export const createTeacherInput = z.object({
  fullName: z.string().trim().min(3).max(120),
  username: usernameSchema,
  temporaryPassword: z.string().min(8).max(72),
});

// ---------- Grupos, materias y guías ----------

export const createGroupInput = z.object({
  clei: z.number().int().min(1).max(6),
  identifier: z.string().trim().toUpperCase().regex(/^[A-Z]$/), // una letra: así el código mide siempre lo mismo
  shift: shiftSchema,
  schoolYear: z.number().int().min(2020).max(2100),
});

/** PATCH /v1/groups/:id: cualquiera de los campos de createGroupInput, o varios. */
export const updateGroupInput = createGroupInput.partial();

/** La lista de admin-02 cabe en una página; el total se devuelve siempre. */
export const GROUPS_PAGE_SIZE = 12;

/** GET /v1/groups: q busca por etiqueta/código, shift filtra la jornada, page/pageSize paginan. */
export const groupListQuery = z.object({
  q: z.string().trim().max(60).optional(),
  shift: shiftSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(GROUPS_PAGE_SIZE),
});

export const createSubjectInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  teacherId: z.uuid(),
});

export const guideStatusSchema = z.enum(["draft", "published"]);

export const guideFields = z.object({
  topic: z.string().trim().min(2).max(60),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(600),
  status: guideStatusSchema,
});

export const MAX_GUIDE_BYTES = 10 * 1024 * 1024; // 10 MB, como dice el Figma
export const GUIDE_MIME = "application/pdf";
