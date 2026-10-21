import { randomInt } from "node:crypto";
import { ACCESS_CODE_ALPHABET } from "@censaguias/shared";

/** Genera un código XXXX-XXXX con 31^8 ≈ 8,5·10^11 combinaciones. */
export function generateAccessCode(): string {
  let raw = "";
  for (let i = 0; i < 8; i++) raw += ACCESS_CODE_ALPHABET[randomInt(ACCESS_CODE_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
