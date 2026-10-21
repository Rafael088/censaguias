import { z } from "zod";

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L). Ver docs/decisiones/0004-codigo-de-acceso.md
export const ACCESS_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ACCESS_CODE_REGEX = /^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

/** Normaliza lo que escribe el estudiante: mayúsculas, sin espacios, con guion en medio. */
export function normalizeAccessCode(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
}

export const roleSchema = z.enum(["admin", "teacher"]);
export type Role = z.infer<typeof roleSchema>;

export const accessCodeInput = z.object({
  code: z.string().transform(normalizeAccessCode).pipe(z.string().regex(ACCESS_CODE_REGEX)),
});

export const createGroupInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
});

export const createSubjectInput = z.object({
  groupId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
});

export const createGuideInput = z.object({
  subjectId: z.uuid(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
});

export const MAX_GUIDE_BYTES = 20 * 1024 * 1024; // 20 MB
export const GUIDE_MIME = "application/pdf";
