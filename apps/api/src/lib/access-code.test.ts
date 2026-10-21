import { describe, expect, it } from "vitest";
import { ACCESS_CODE_REGEX, normalizeAccessCode } from "@censaguias/shared";
import { generateAccessCode } from "./access-code.js";

describe("código de acceso", () => {
  it("genera códigos con el formato válido", () => {
    for (let i = 0; i < 500; i++) expect(generateAccessCode()).toMatch(ACCESS_CODE_REGEX);
  });

  it("normaliza lo que escribe el estudiante", () => {
    expect(normalizeAccessCode(" abcd efgh ")).toBe("ABCD-EFGH");
    expect(normalizeAccessCode("abcd-efgh")).toBe("ABCD-EFGH");
  });
});
