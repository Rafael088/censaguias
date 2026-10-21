# AGENTS.md — CensaGuias

Lee esto antes de tocar el repo. Vale para cualquier agente (Claude Code, Codex, Cursor, OpenCode…) y para personas.

## Qué es

CensaGuias centraliza las guías en PDF de las asignaturas de un grupo, para que los estudiantes no dependan de Drive.

- **Admin**: crea grupos (al crearlo se genera un **código de acceso**), crea asignaturas dentro del grupo, invita profesores y los asigna a asignaturas.
- **Profesor**: inicia sesión con correo; ve solo sus asignaturas; sube, edita y borra guías de esas asignaturas.
- **Estudiante**: **no tiene cuenta**. Escribe el código del grupo → ve las asignaturas del grupo → abre/descarga las guías.

## Mapa del repo

```
apps/web        Next.js 16 (App Router) + Tailwind 4. UI. Llama a la API por /api/* (rewrite).
apps/api        Hono 4 sobre Node. Única puerta a Supabase. Exporta `AppType` para el cliente tipado.
packages/shared Esquemas zod y constantes compartidas (código de acceso, límites del PDF).
supabase/       Migraciones SQL (fuente de verdad del esquema) y seed.
docs/           ARQUITECTURA.md, DISENO.md, PLANNING-v0.1.0.md, decisiones/ (ADRs).
```

Más detalle: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md). Por qué es así: [docs/decisiones/](docs/decisiones/).

## Reglas que no se rompen

1. **El navegador nunca habla con las tablas ni con Storage de Supabase.** Todo pasa por `apps/api`. El front solo usa Supabase Auth para el login de staff (ADR 0003).
2. **`SUPABASE_SERVICE_ROLE_KEY` vive solo en `apps/api`.** Nunca en `apps/web`, nunca con prefijo `NEXT_PUBLIC_`, nunca en git.
3. **Autorizar en la API, siempre.** Cada ruta pasa por `requireStaff(...)` o `requireStudent`. Un profesor solo toca asignaturas donde está en `subject_teachers`; un estudiante solo ve el `group_id` de su sesión. Como el cliente de la API salta RLS, si una ruta no comprueba, nadie más lo hará.
4. **El esquema cambia solo con migraciones nuevas** en `supabase/migrations/` (`YYYYMMDDHHMMSS_que_hace.sql`). Nunca edites una migración ya mergeada.
5. **No dupliques tipos de la API en el front.** Usa `api` de `apps/web/lib/api.ts` (`hc<AppType>`); las respuestas se tipan solas. Los esquemas de entrada van en `packages/shared`.
6. **Los PDF se descargan con URL firmada de corta vida** (60 s) que genera la API. El bucket `guides` es privado.
7. **El rol nunca sale de datos que escribe el usuario** (metadatos de Auth, body de la request). Sale de `profiles.role`.
8. La UI sigue el Figma (ver [docs/DISENO.md](docs/DISENO.md)). Si el Figma no cubre un caso, sigue los componentes que ya existen; no inventes un estilo nuevo.

## Convenciones

- **Idioma**: código (identificadores, tablas, rutas) en inglés; textos de UI, docs, commits y PRs en español.
- Rutas de la API versionadas: `/v1/<recurso>` en plural (`/v1/groups`, `/v1/subjects/:id/guides`).
- Errores de la API: `{ "error": "mensaje para mostrar" }` con el status correcto (400/401/403/404/409/413).
- TypeScript estricto. Nada de `any` sin un comentario que diga por qué.
- Componentes React en `kebab-case.tsx`, exportados con nombre.
- Commits: `tipo(ámbito): qué cambia` → `feat(api): subir guías`, `fix(web): …`, `docs: …`.

## Cómo trabajar una tarea

1. Toma una tarea de [docs/PLANNING-v0.1.0.md](docs/PLANNING-v0.1.0.md) (cada una es un issue con el mismo ID, p. ej. `API-04`). Asígnate el issue.
2. Rama desde `main`: `feat/API-04-subir-guias`.
3. Antes de abrir el PR: `npm run typecheck && npm test` en verde.
4. PR a `main` con `Closes #<issue>`, qué cambió y cómo probarlo. No se mergea sin una revisión.
5. Si tomas una decisión de arquitectura nueva, añade un ADR en `docs/decisiones/` en el mismo PR.

## Comandos

```bash
npm install                 # una vez, en la raíz
npm run dev:api             # API en http://localhost:8787
npm run dev:web             # Web en http://localhost:3000
npm run typecheck           # todos los paquetes
npm test                    # vitest (api)
npx supabase db push        # aplicar migraciones al proyecto enlazado
```
