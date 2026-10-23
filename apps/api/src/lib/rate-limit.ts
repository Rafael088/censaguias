import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { getConnInfo } from "@hono/node-server/conninfo";

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const TOO_MANY_ATTEMPTS = "Demasiados intentos. Vuelve a intentarlo en un minuto.";

// Ventana deslizante en memoria: en la 0.1.0 la API corre en una sola instancia,
// así que un Map basta. Si algún día hay varias, este almacén hay que compartirlo
// (Redis u otro) porque cada instancia contaría por su lado.
const hits = new Map<string, number[]>();
const SWEEP_AT = 1000; // no dejar crecer el Map sin más: IPs que nunca vuelven

function sweep(now: number) {
  const desde = now - RATE_LIMIT_WINDOW_MS;
  for (const [key, times] of hits) {
    const vivos = times.filter((t) => t > desde);
    if (vivos.length === 0) hits.delete(key);
    else hits.set(key, vivos);
  }
}

/** ¿Pasa este intento? Cuenta y devuelve false cuando la clave ya agotó la ventana. `now` es para tests. */
export function takeTurn(key: string, now = Date.now()): boolean {
  if (hits.size > SWEEP_AT) sweep(now);
  const desde = now - RATE_LIMIT_WINDOW_MS;
  const vivos = (hits.get(key) ?? []).filter((t) => t > desde);
  const pasa = vivos.length < RATE_LIMIT_MAX;
  if (pasa) vivos.push(now);
  hits.set(key, vivos);
  return pasa;
}

/** Solo para tests: la ventana vive en memoria, como el proceso. */
export function resetRateLimits(): void {
  hits.clear();
}

/** IP del cliente. El último X-Forwarded-For es el que añade el proxy de confianza
 *  (Vercel/Next), así que no lo puede falsear quien llama; si no, la del socket.
 *  Sin servidor Node detrás (tests) no hay socket, y eso no debe tumbar la request. */
export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const saltos = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    const ultimo = saltos.at(-1);
    if (ultimo) return ultimo;
  }
  try {
    return getConnInfo(c).remote?.address ?? "sin-ip";
  } catch {
    return "sin-ip";
  }
}

/** Lanza 429 si la clave ya se quedó sin intentos en esta ventana. */
export function takeTurnOr429(key: string): void {
  if (!takeTurn(key)) throw new HTTPException(429, { message: TOO_MANY_ATTEMPTS });
}

/** Protege una ruta entera por una clave de la request (p. ej. la IP). */
export const rateLimit = (keyOf: (c: Context) => string) =>
  createMiddleware(async (c, next) => {
    takeTurnOr429(keyOf(c));
    await next();
  });
