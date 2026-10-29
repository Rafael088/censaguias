import { beforeEach, describe, expect, it } from "vitest";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, resetRateLimits, takeTurn } from "./rate-limit.js";

// Un minuto "redondo" para que los cálculos de ventana se vean claros.
const AHORA = 1_700_000_000_000;

beforeEach(() => resetRateLimits());

describe("takeTurn", () => {
  it("deja pasar el máximo de intentos y corta el siguiente", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(takeTurn("access:1.2.3.4", AHORA + i)).toBe(true);
    }
    expect(takeTurn("access:1.2.3.4", AHORA + RATE_LIMIT_MAX)).toBe(false);
  });

  it("es una ventana deslizante: lo intentado hace un minuto ya no cuenta", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) takeTurn("access:1.2.3.4", AHORA + i);
    expect(takeTurn("access:1.2.3.4", AHORA + RATE_LIMIT_WINDOW_MS - 1)).toBe(false);

    // Un minuto después del primer intento, ese sale de la ventana y vuelve a caber uno.
    expect(takeTurn("access:1.2.3.4", AHORA + RATE_LIMIT_WINDOW_MS)).toBe(true);
  });

  it("cada clave lleva su cuenta aparte", () => {
    for (let i = 0; i <= RATE_LIMIT_MAX; i++) takeTurn("access:1.2.3.4", AHORA + i);
    expect(takeTurn("access:1.2.3.4", AHORA)).toBe(false);
    expect(takeTurn("access:5.6.7.8", AHORA)).toBe(true);
    expect(takeTurn("login:luis.docente", AHORA)).toBe(true);
  });

  it("resetRateLimits empieza de cero (para los tests)", () => {
    for (let i = 0; i <= RATE_LIMIT_MAX; i++) takeTurn("login:ana.admin", AHORA + i);
    expect(takeTurn("login:ana.admin", AHORA)).toBe(false);
    resetRateLimits();
    expect(takeTurn("login:ana.admin", AHORA)).toBe(true);
  });
});
