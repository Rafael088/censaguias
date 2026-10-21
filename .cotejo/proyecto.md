---
id: proyecto
version: 0.1.0
---
# censaguias

## Objetivo
Plataforma educativa de CENSA: las guías en PDF de cada grupo CLEI en un solo lugar. Los estudiantes entran con un código corto (CENSA-4AM-K7Q), sin cuenta ni Drive; los profesores publican las guías de sus materias y el admin organiza grupos, materias y docentes.

## Stack
Monorepo con npm workspaces: Next.js 16 y Tailwind 4 (apps/web), Hono 4 (apps/api) y Supabase (Postgres, Auth y Storage). Reglas para los agentes en AGENTS.md; diseño en docs/diseno/.

## Siguiente paso
INF-01: crear el proyecto de Supabase y el primer admin (lo hace Rafael). En paralelo: WEB-01 (componentes base) y API-03 (límite de intentos).
