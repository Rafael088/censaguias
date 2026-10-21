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
export const ACCESS_CODE_REGEX = /^CENSA-[1-6][A-Z]{1,2}[MNS]-\d{2}-[A-HJKMNP-Z2-9]{4}$/;

/** Prefijo legible del código: CENSA-4AM-26 (CLEI IV, grupo A, Mañana, 2026). */
export function accessCodePrefix(g: { clei: number; identifier: string; shift: Shift; schoolYear: number }): string {
  return `CENSA-${g.clei}${g.identifier}${SHIFT_LETTER[g.shift]}-${String(g.schoolYear % 100).padStart(2, "0")}`;
}

/** Normaliza lo que escribe el estudiante: mayúsculas, sin espacios, guiones tipográficos → "-". */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/\s+/g, "").replace(/[‐-―−]/g, "-");
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
  identifier: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}$/),
  shift: shiftSchema,
  schoolYear: z.number().int().min(2020).max(2100),
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
