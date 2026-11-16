# Despliegue en Vercel

Guía para publicar CensaGuias en Vercel. Es una tarea de persona: yo (el agente) no puedo crear proyectos, cargar secretos ni activar el Git integration. Aquí están los pasos exactos para ejecutarlos con tu cuenta.

Dos proyectos independientes:

| Proyecto | Root Directory | Entrada | URL |
| --- | --- | --- | --- |
| `censaguias-api` | `apps/api` | `src/app.ts` (export por defecto de Hono, preparado en INF-02b) | la que te dé Vercel |
| `censaguias-web` | `apps/web` | Next.js (detección automática) | la que te dé Vercel |

El navegador siempre llama a `/api/*` del web y `next.config.ts` lo reenvía a `API_URL` (ADR 0002), así que la cookie del estudiante es de primera parte.

## 0. Preparación

```sh
npm i -g vercel@latest
vercel login
```

Ten a mano estos valores antes de empezar (están en el gestor de secretos del equipo):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `STUDENT_SESSION_SECRET` (mínimo 32 caracteres)
- `WEB_ORIGIN` (la URL del web; se sabrá al crear el proyecto web)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

`.vercel` ya está en `.gitignore`, así que los enlaces locales no se suben al repo.

## 1. Proyecto de la API

Desde la raíz del repo:

```sh
cd apps/api
vercel link
```

`vercel link` crea el proyecto si no existe (elige el equipo y ponle por ejemplo `censaguias-api`). Crea `apps/api/.vercel/`. Comprueba en el dashboard que **Settings → General → Root Directory** sea `apps/api`.

Vercel detecta Hono por el `export default app` de `src/app.ts`: **no hace falta `vercel.json`** ni configurar un builder a mano (INF-02b lo dejó listo).

Variables de entorno (la CLI te pide el valor de forma interactiva; para secretos añade `--sensitive`):

```sh
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
vercel env add STUDENT_SESSION_SECRET production --sensitive
vercel env add WEB_ORIGIN production
vercel env add STAFF_EMAIL_DOMAIN production
```

Repite las mismas para `preview` (cambia `production` por `preview`). No definas `PORT`: lo asigna Vercel.

Despliega y comprueba:

```sh
vercel --prod
curl <URL-DE-LA-API>/health
```

Debe responder `{"ok":true}`. Si responde 500, revisa que `SUPABASE_*` y `STUDENT_SESSION_SECRET` estén cargados. **Anota la URL de la API**: la necesitas para el web.

## 2. Proyecto del web

```sh
cd apps/web
vercel link
```

Crea el proyecto `censaguias-web`. **Root Directory** debe ser `apps/web`. Next.js se detecta solo.

Variables:

```sh
vercel env add API_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

`API_URL` es la URL de la API del paso 1, **sin barra final**. Ojo: `next.config.ts` la lee **al construir**, así que tiene que existir antes del build (también en Preview). No es `NEXT_PUBLIC_`: solo la lee Next en el servidor.

`WEB_ORIGIN` en la API debe ser la URL de este web (CORS cubre `/v1/*`). Ajusta la variable si hace falta:

```sh
cd ../api
vercel env add WEB_ORIGIN production   # valor: URL del web
```

Despliega y comprueba el rewrite:

```sh
cd ../web
vercel --prod
curl <URL-DEL-WEB>/api/health
```

Debe responder `{"ok":true}` a través del rewrite `/api/* → API_URL`.

## 3. Previews en cada PR

Conecta el repositorio de Git a los dos proyectos. Desde cada carpeta enlazada:

```sh
cd apps/api
vercel git connect --yes

cd ../web
vercel git connect --yes
```

Si `git connect` no encuentra el remoto, pásalo explícitamente:

```sh
vercel git connect github.com/Rafael088/censaguias.git --yes
```

Con eso, cada PR genera un deployment de preview de cada app. Dos detalles importantes:

- En el proyecto **web**, `API_URL` del entorno *Preview* debe apuntar a la API. Si usas la URL efímera de cada preview, configura un alias de preview estable en el proyecto de la API y apunta allí; o usa variables por rama:
  ```sh
  vercel env add API_URL preview --git-branch <nombre-de-rama>
  ```
- En el proyecto **API**, `WEB_ORIGIN` del entorno *Preview* debe ser la URL de preview del web para que CORS y las cookies sigan funcionando.

## 4. Comprobación antes de dar por hecho INF-02

- [ ] `GET <URL-API>/health` → 200 `{"ok":true}`
- [ ] `GET <URL-WEB>/api/health` → 200 `{"ok":true"}` (rewrite)
- [ ] Acceso del estudiante con un código real de grupo
- [ ] Login de staff con usuario institucional
- [ ] Subir y descargar un PDF de prueba

Si la subida de un PDF de 10 MB falla con 413, Vercel está cortando el body a 4,5 MB: es lo que cubre **API-05b** (ADR 0005, subida firmada). No intentes arreglarlo aumentando el límite del plan.

## 5. Problemas habituales

- **`Module not found: @censaguias/shared` durante el build.** El repo usa npm workspaces. Vercel suele detectar el `package-lock.json` de la raíz e instalar desde ahí; si no, pon el Install Command a `npm install` ejecutado desde la raíz del repositorio (Settings → General → Build & Development Settings).
- **CORS en el preview.** Casi siempre es `WEB_ORIGIN` de la API apuntando a la URL de producción del web en vez de a la de preview.
- **El estudiante vuelve al código al recargar.** La cookie se pierde si el rewrite `/api/*` no está activo o si `API_URL` apunta al dominio equivocado; comprueba el paso 2.
- **Revisar logs:** `vercel logs <URL-de-deployment> --follow`, ejecutado desde la carpeta de la app correspondiente.

## Después de desplegar

Cuando INF-02 esté desplegada, se puede acometer **REL-01** (prueba de aceptación de los 8 pasos del `PLANNING-v0.1.0.md`, etiquetado de `v0.1.0` y notas de la versión). Recuerda que etiquetar y publicar el release lo hace una persona.
