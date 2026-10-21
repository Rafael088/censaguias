# 0002 · Cliente tipado de Hono y API detrás del rewrite de Next

**Estado:** Aceptada (2026-10-20)

**Contexto.** Queremos que el front sepa qué devuelve cada ruta sin escribir los tipos dos veces. Y la sesión del estudiante va en una cookie: si web y API están en dominios distintos, la cookie sería de terceros y Safari/Chrome la bloquean.

**Decisión.**
- `apps/api` exporta `AppType` (`typeof app`). El front usa `hc<AppType>("/api")` (`apps/web/lib/api.ts`). Para que funcione, las rutas se encadenan (`new Hono().get(...).post(...)`) y se montan con `.route()`.
- El navegador solo llama a `/api/*` del dominio del front. `next.config.ts` reenvía eso a la API (`API_URL`). La cookie queda de primera parte con `SameSite=Lax`.

**Consecuencias.**
- Cambiar la forma de una respuesta rompe el typecheck del front → se detecta en el PR.
- Las rutas de Hono deben devolver `c.json(...)` con tipos concretos, no `any`.
- Las subidas pasan por el rewrite; ojo al límite de tamaño de body del hosting (ver 0005).
