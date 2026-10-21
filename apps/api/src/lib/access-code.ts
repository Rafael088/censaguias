import { randomInt } from "node:crypto";
import { ACCESS_CODE_ALPHABET, ACCESS_CODE_SUFFIX_LENGTH, accessCodePrefix, type Shift } from "@censaguias/shared";

/**
 * CENSA-4AM-K7Q. "4AM" es el grupo (se adivina); "K7Q" es aleatorio (31^3 ≈ 30 000 combinaciones).
 * Lo que protege el acceso es ese sufijo junto con el límite de intentos de POST /v1/access (ADR 0004).
 */
export function generateAccessCode(g: { clei: number; identifier: string; shift: Shift }): string {
  let suffix = "";
  for (let i = 0; i < ACCESS_CODE_SUFFIX_LENGTH; i++) suffix += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  return `${accessCodePrefix(g)}-${suffix}`;
}
