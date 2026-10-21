import { describe, expect, it } from "vitest";
import { ACCESS_CODE_REGEX, normalizeAccessCode } from "@censaguias/shared";
import { generateAccessCode } from "./access-code.js";

const grupo = { clei: 4, identifier: "A", shift: "morning", schoolYear: 2026 } as const;

describe("código de acceso", () => {
  it("lleva el prefijo legible del grupo y un sufijo válido", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateAccessCode(grupo);
      expect(code).toMatch(ACCESS_CODE_REGEX);
      expect(code.startsWith("CENSA-4AM-26-")).toBe(true);
    }
  });

  it("codifica jornada y año", () => {
    expect(generateAccessCode({ clei: 5, identifier: "B", shift: "night", schoolYear: 2027 })).toMatch(/^CENSA-5BN-27-/);
    expect(generateAccessCode({ clei: 6, identifier: "A", shift: "saturday", schoolYear: 2026 })).toMatch(/^CENSA-6AS-26-/);
  });

  it("normaliza lo que escribe el estudiante", () => {
    expect(normalizeAccessCode(" censa-4am-26-k7qx ")).toBe("CENSA-4AM-26-K7QX");
    expect(normalizeAccessCode("CENSA–4AM–26–K7QX")).toBe("CENSA-4AM-26-K7QX");
  });
});
