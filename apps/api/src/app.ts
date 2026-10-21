import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { accessRoutes } from "./routes/access.js";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

export const app = new Hono()
  .use(logger())
  // El navegador entra por el rewrite de Next (mismo origen); CORS solo cubre llamadas directas.
  .use("/v1/*", cors({ origin: webOrigin, credentials: true }))
  .get("/health", (c) => c.json({ ok: true }))
  .route("/v1/access", accessRoutes);
// Siguientes rutas del MVP (docs/PLANNING-v0.1.0.md): /v1/groups, /v1/subjects, /v1/guides, /v1/teachers, /v1/me

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Error interno" }, 500);
});

/** Tipo que consume el front con `hc<AppType>()` (ADR 0002). */
export type AppType = typeof app;
