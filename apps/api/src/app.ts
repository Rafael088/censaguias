import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { accessRoutes } from "./routes/access.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { groupRoutes } from "./routes/groups.js";
import { meRoutes } from "./routes/me.js";
import { groupSubjectRoutes, subjectRoutes } from "./routes/subjects.js";
import { subjectGuideRoutes } from "./routes/guides.js";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

/**
 * Fábrica de la app: el servidor usa `app` (una sola instancia) y los tests pueden pedir
 * varias, porque Hono no deja añadir rutas una vez construido su router.
 *
 * Va sin anotación de retorno a propósito: el tipo con las rutas es el que infiere TS, y de
 * ahí sale AppType para el front (`hc<AppType>`); un `: Hono` lo borraría todo.
 */
export function createApp() {
  const app = new Hono()
    .use(logger())
    // El navegador entra por el rewrite de Next (mismo origen); CORS solo cubre llamadas directas.
    .use("/v1/*", cors({ origin: webOrigin, credentials: true }))
    .get("/health", (c) => c.json({ ok: true }))
    .route("/v1/access", accessRoutes)
    .route("/v1/auth", authRoutes)
    .route("/v1/me", meRoutes)
    .route("/v1/groups", groupRoutes)
    .route("/v1/groups", groupSubjectRoutes)
    .route("/v1/subjects", subjectRoutes)
    .route("/v1/subjects", subjectGuideRoutes)
    .route("/v1/admin", adminRoutes);
  // Siguientes rutas del MVP: ver la tabla de docs/ARQUITECTURA.md

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Error interno" }, 500);
  });
  return app;
}

export const app = createApp();

/** Tipo que consume el front con `hc<AppType>()` (ADR 0002). */
export type AppType = typeof app;
