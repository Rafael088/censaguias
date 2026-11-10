---
id: proyecto
version: 0.1.0
---
# censaguias

## Objetivo
Plataforma educativa de CENSA: las guías en PDF de cada grupo CLEI en un solo lugar. Los estudiantes entran con un código corto (CENSA-4AM-K7Q), sin cuenta ni Drive; los profesores publican las guías de sus materias y el admin organiza grupos, materias y docentes.

## Stack
Monorepo con npm workspaces: Next.js 16 y Tailwind 4 (apps/web), Hono 4 (apps/api) y Supabase (Postgres, Auth y Storage). Reglas para los agentes en AGENTS.md; diseño en docs/diseno/. `npm run dev` arranca la web (3000) y la API (8787) a la vez.

## Siguiente paso
Validar en el board WEB-06, integrado en main mediante el PR #30, y completar WEB-06b para sustituir los datos de muestra por las rutas reales de API-08. En paralelo siguen WEB-05 (detalle de grupo), WEB-02b (estudiante con datos reales) e INF-02 (Vercel), que hace Rafael.
