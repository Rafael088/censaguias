# Arquitectura

## Vista general

```
 Navegador ──► apps/web (Next.js) ──rewrite /api/*──► apps/api (Hono) ──service_role──► Supabase
     │                                                     │                         ├─ Postgres (tablas)
     └── Supabase Auth (solo login de staff) ◄─────────────┘ verifica el token        └─ Storage (bucket "guides", privado)
```

- **apps/web** pinta la UI. No guarda datos ni secretos. Todas las llamadas van a `/api/...`, que Next reenvía a la API (`next.config.ts`). Así la cookie del estudiante es del mismo dominio.
- **apps/api** es la única que conoce `SUPABASE_SERVICE_ROLE_KEY`. Valida la entrada (zod), autoriza y lee/escribe en Supabase.
- **Supabase**: Postgres con RLS activo y sin políticas públicas (nadie entra directo), Auth para staff, Storage para los PDF.

## Actores y sesiones

| Actor | Cómo entra | Qué lleva cada request | Middleware |
|---|---|---|---|
| Admin | Correo + contraseña (Supabase Auth) | `Authorization: Bearer <access_token>` | `requireStaff("admin")` |
| Profesor | Invitación por correo del admin → define contraseña | `Authorization: Bearer <access_token>` | `requireStaff("teacher", "admin")` + comprobar `subject_teachers` |
| Estudiante | Código del grupo `XXXX-XXXX` | Cookie `cg_student` (JWT HS256, 30 días, `httpOnly`) | `requireStudent` |

La cookie del estudiante guarda `group_id` y `code_version`. Si el admin **regenera** el código o **archiva** el grupo, `code_version` cambia y las sesiones viejas dejan de valer en la siguiente request.

## Modelo de datos

```
profiles (staff) 1─┐
                   ├─< groups.created_by
groups 1───────────< subjects 1──────< guides
                         │                 └─ storage_path → bucket guides/{group_id}/{subject_id}/{guide_id}.pdf
                         └──< subject_teachers >── profiles (role = teacher)
```

| Tabla | Para qué |
|---|---|
| `profiles` | Staff. `id` = `auth.users.id`. `role`: `admin` \| `teacher`. Se crea sola al invitar (trigger), siempre como `teacher`. |
| `groups` | Grupo/curso. `access_code` único, `code_version`, `archived_at`. |
| `subjects` | Asignatura de un grupo. Nombre único dentro del grupo. |
| `subject_teachers` | Qué profesor lleva qué asignatura (N:M). |
| `guides` | Metadatos del PDF. El archivo vive en Storage. |

Esquema exacto: `supabase/migrations/`.

## API (v1)

Contrato objetivo del MVP. ✅ = ya existe en el código.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /health` ✅ | todos | Ping |
| `POST /v1/access` ✅ | público | Canjea el código → cookie de estudiante + `{ group }` |
| `DELETE /v1/access` ✅ | estudiante | Cierra la sesión del estudiante |
| `GET /v1/me` | staff | Perfil y rol del staff logueado |
| `GET /v1/student/group` | estudiante | Grupo + asignaturas |
| `GET /v1/student/subjects/:id/guides` | estudiante | Guías de una asignatura de su grupo |
| `GET /v1/guides/:id/download` | estudiante o staff con acceso | URL firmada (60 s) del PDF |
| `GET/POST /v1/groups` | admin | Listar / crear grupo (genera código) |
| `PATCH /v1/groups/:id` | admin | Renombrar, archivar |
| `POST /v1/groups/:id/code` | admin | Regenerar código (sube `code_version`) |
| `GET/POST /v1/groups/:id/subjects` | admin | Asignaturas del grupo |
| `PATCH/DELETE /v1/subjects/:id` | admin | Editar / borrar asignatura |
| `PUT /v1/subjects/:id/teachers` | admin | Fijar profesores de la asignatura |
| `GET/POST /v1/teachers` | admin | Listar / invitar profesor |
| `GET /v1/teacher/subjects` | profesor | Sus asignaturas |
| `GET/POST /v1/subjects/:id/guides` | profesor a cargo, admin | Listar / subir guía (multipart, PDF ≤ 20 MB) |
| `PATCH/DELETE /v1/guides/:id` | profesor a cargo, admin | Editar título / borrar guía y archivo |

## Subida de un PDF

1. El front manda `multipart/form-data` (`file`, `title`, `description`) a `POST /api/v1/subjects/:id/guides`.
2. La API comprueba rol y `subject_teachers`, que sea `application/pdf`, que empiece por `%PDF` y que pese ≤ 20 MB.
3. Genera `guide_id`, sube a `guides/{group_id}/{subject_id}/{guide_id}.pdf`, inserta la fila. Si la inserción falla, borra el archivo.

> Si en Vercel el límite de body (4,5 MB) se queda corto, se cambia a subida directa con `createSignedUploadUrl` (ver ADR 0005).

## Primer admin

El registro público está desactivado. Para el primer admin:
1. Supabase → Authentication → *Invite user* con tu correo.
2. SQL editor: `update public.profiles set role = 'admin' where email = 'tu@correo';`

## Despliegue (objetivo)

- `apps/web` y `apps/api` en Vercel como dos proyectos (raíz `apps/web` y `apps/api`). `API_URL` del web apunta a la URL de la API.
- Supabase: un proyecto para producción; cada dev usa `supabase start` local o un proyecto propio.
