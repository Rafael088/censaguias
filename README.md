# CensaGuias

Las guías en PDF de las asignaturas de un grupo, en un solo lugar y sin Drive.
Los estudiantes entran con el **código de acceso** de su grupo; los profesores suben las guías de sus asignaturas; el admin organiza grupos, asignaturas y profesores.

**Stack**: Next.js 16 · Hono 4 · Supabase (Postgres, Auth, Storage) · TypeScript · npm workspaces.

## Empezar

```bash
git clone https://github.com/Rafael088/censaguias.git
cd censaguias
npm install
cp .env.example apps/api/.env          # y rellena los valores de Supabase
cp .env.example apps/web/.env.local    # solo las variables NEXT_PUBLIC_*
npx supabase link --project-ref <ref>
npx supabase db push
npm run dev:api   # http://localhost:8787
npm run dev:web   # http://localhost:3000
```

## Documentación

- [AGENTS.md](AGENTS.md) — reglas y convenciones (para personas y agentes de IA)
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) — cómo encaja todo
- [docs/DISENO.md](docs/DISENO.md) — diseño y Figma
- [docs/decisiones/](docs/decisiones/) — decisiones de arquitectura (ADRs)
- [docs/PLANNING-v0.1.0.md](docs/PLANNING-v0.1.0.md) — planning del MVP
