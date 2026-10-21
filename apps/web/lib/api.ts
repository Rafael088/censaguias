import { hc } from "hono/client";
import type { AppType } from "@censaguias/api";

/** Cliente tipado de la API. Las rutas y respuestas salen del tipo de Hono, no se duplican (ADR 0002). */
export const api = hc<AppType>("/api", { init: { credentials: "include" } });
