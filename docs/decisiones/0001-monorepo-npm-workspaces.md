# 0001 · Monorepo con npm workspaces

**Estado:** Aceptada (2026-10-20)

**Contexto.** Front (Next.js) y back (Hono) comparten esquemas de validación y el tipo de la API. Somos un equipo pequeño y cada uno trabaja con su agente.

**Decisión.** Un solo repo con `apps/web`, `apps/api` y `packages/shared`, usando npm workspaces (sin Turborepo ni pnpm). Los paquetes internos se importan como código fuente TypeScript (`"exports": "./src/index.ts"`), sin paso de build.

**Consecuencias.**
- Un PR puede tocar API y front a la vez y el typecheck detecta si se rompe el contrato.
- Nada que instalar aparte de Node 22+.
- Si el build se vuelve lento se puede añadir Turborepo sin mover carpetas.
