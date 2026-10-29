import { hc } from "hono/client";
import type { AppType } from "@censaguias/api";
import { getAccessToken } from "./supabase";

/** Cliente tipado de la API. Las rutas y respuestas salen del tipo de Hono, no se duplican (ADR 0002). */
export const api = hc<AppType>("/api", {
  init: { credentials: "include" },
  // El Bearer se añade aquí, en un solo sitio, antes de cada llamada: así ninguna ruta puede
  // olvidarse de mandarlo (ADR 0003). Sin token la llamada sale igual y la API responde 401.
  fetch: async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args;
    const token = await getAccessToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  },
});
