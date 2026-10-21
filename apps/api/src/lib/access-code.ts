import { randomInt } from "node:crypto";
import { ACCESS_CODE_ALPHABET, accessCodePrefix, type Shift } from "@censaguias/shared";

/**
 * CENSA-4AM-26-K7QX. El prefijo se adivina (CLEI, grupo, jornada, año); el sufijo de 4 caracteres
 * aleatorios (31^4 ≈ 923 000) más el límite de intentos es lo que protege el acceso (ADR 0004).
 */
export function generateAccessCode(g: { clei: number; identifier: string; shift: Shift; schoolYear: number }): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  return `${accessCodePrefix(g)}-${suffix}`;
}
