import { describe, expect, it } from "vitest";
import { ACCESS_CODE_REGEX, normalizeAccessCode } from "@censaguias/shared";
import { generateAccessCode } from "./access-code.js";

describe("código de acceso", () => {
  it("lleva el grupo y un sufijo válido", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateAccessCode({ clei: 4, identifier: "A", shift: "morning" });
      expect(code).toMatch(ACCESS_CODE_REGEX);
      expect(code.startsWith("CENSA-4AM-")).toBe(true);
    }
  });

  it("codifica la jornada", () => {
    expect(generateAccessCode({ clei: 5, identifier: "B", shift: "night" })).toMatch(/^CENSA-5BN-/);
    expect(generateAccessCode({ clei: 6, identifier: "A", shift: "saturday" })).toMatch(/^CENSA-6AS-/);
  });

  it("acepta el código escrito de cualquier forma", () => {
    for (const typed of ["4amk7q", "4AM K7Q", "4am-k7q", " censa-4am-k7q ", "CENSA–4AM–K7Q", "censa4amk7q"]) {
      expect(normalizeAccessCode(typed)).toBe("CENSA-4AM-K7Q");
    }
  });

  it("rechaza lo que no tiene 6 caracteres", () => {
    expect(normalizeAccessCode("CENSA-000")).not.toMatch(ACCESS_CODE_REGEX);
  });
});
