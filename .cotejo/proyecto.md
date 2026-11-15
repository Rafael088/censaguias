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
Comprobar WEB-06b en el board: el PR #33 ya conectó la administración de profesores con API-08 y eliminó teachers-demo.ts. Después quedan INF-02 (despliegue en Vercel, a cargo de Rafael), API-05b (probar la subida de 10 MB desplegada) y REL-01 (aceptación y release). WEB-05, WEB-06, WEB-07, WEB-08 y WEB-02b ya fueron comprobadas.
