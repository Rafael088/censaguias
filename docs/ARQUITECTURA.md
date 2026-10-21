# Arquitectura

## Vista general

```
 Navegador ──► apps/web (Next.js) ──rewrite /api/*──► apps/api (Hono) ──service_role──► Supabase
     │                                                     │                         ├─ Postgres (tablas)
     └── supabase-js: solo guarda/refresca la sesión staff ┘ verifica el token        ├─ Auth (staff)
                                                                                      └─ Storage (bucket "guides", privado)
```

- **apps/web** pinta la UI (ver [DISENO.md](DISENO.md)). No guarda datos ni secretos. Todas las llamadas van a `/api/...`, y Next las reenvía a la API (`next.config.ts`). Así la cookie del estudiante queda en el mismo dominio.
- **apps/api** es la única que conoce `SUPABASE_SERVICE_ROLE_KEY`. Valida la entrada (zod), autoriza y lee/escribe en Supabase.
- **Supabase**: Postgres con RLS activo y sin políticas públicas (nadie entra directo), Auth para el staff y Storage para los PDF.

## Actores y sesiones

| Actor | Cómo entra | Qué lleva cada request | Middleware |
|---|---|---|---|
| Admin | Usuario institucional + contraseña (`POST /v1/auth/login`) | `Authorization: Bearer <access_token>` | `requireStaff("admin")` |
| Profesor | Usuario + contraseña temporal que le da el admin | `Authorization: Bearer <access_token>` | `requireStaff("teacher")` + `subjects.teacher_id = staff.id` |
| Estudiante | Código del grupo `CENSA-4AM-26-K7QX` | Cookie `cg_student` (JWT HS256, 30 días, `httpOnly`) | `requireStudent` |

- La cookie del estudiante guarda `group_id` y `code_version`. Si el admin **regenera** el código o **elimina** el grupo, la sesión deja de valer en la siguiente request.
- Un profesor con `active = false` queda fuera aunque su token siga vigente.
- Por qué el usuario y no el correo: [ADR 0006](decisiones/0006-usuario-institucional.md).

## Modelo de datos

```
profiles (staff: admin | teacher)
   │ 1
   └──────────────┐ teacher_id (un docente por materia, puede quedar vacío)
groups 1 ──────< subjects 1 ──────< guides (draft | published)
 CLEI IV · A                         └─ storage_path → bucket guides/{group_id}/{subject_id}/{guide_id}.pdf
 Mañana · 2026
 CENSA-4AM-26-K7QX
```

| Tabla | Campos clave | Notas |
|---|---|---|
| `profiles` | `username`, `full_name`, `role`, `active` | `id` = `auth.users.id`. La crea la API al registrar al profesor. |
| `groups` | `clei` (1–6), `identifier` (A, B…), `shift` (`morning`/`night`/`saturday`), `school_year`, `access_code`, `code_version` | Único por (clei, identifier, shift, school_year). Se muestra como "CLEI IV · A". |
| `subjects` | `group_id`, `name`, `description`, `teacher_id` | Nombre único dentro del grupo. Si se borra el profesor, `teacher_id` queda en null y las guías se conservan. |
| `guides` | `topic`, `title`, `description`, `status`, `published_at`, `file_name`, `size_bytes`, `page_count` | Los estudiantes solo ven `published`. El tema es texto libre; el front sugiere los temas que ya existen en la materia. |

Esquema exacto: `supabase/migrations/`. Etiquetas para la UI (`SHIFT_LABEL`, `groupLabel`): `packages/shared`.

## API (v1)

Contrato del MVP. ✅ = ya existe en el código.

| Método y ruta | Quién | Qué hace | Pantalla |
|---|---|---|---|
| `GET /health` ✅ | todos | Ping | — |
| `POST /v1/access` ✅ | público | Canjea el código → cookie + `{ group }` | acceso-estudiante |
| `DELETE /v1/access` ✅ | estudiante | Salir / cambiar código | estudiante-06 |
| `POST /v1/auth/login` ✅ | público | Usuario + contraseña → tokens de Supabase | acceso-staff |
| `GET /v1/me` | staff | Perfil, rol y, si es profesor, sus materias | cabecera |
| `GET /v1/student/group` | estudiante | Grupo, materias (docente, nº de guías publicadas) y últimas guías | estudiante-01, 05 |
| `GET /v1/student/subjects/:id/guides?topic=` | estudiante | Guías publicadas de una materia de su grupo y sus temas | estudiante-02, 04 |
| `GET /v1/student/guides/:id` | estudiante | Detalle de una guía publicada | estudiante-03 |
| `GET /v1/guides/:id/file?download=1` | estudiante o staff con acceso | URL firmada (60 s) para abrir o descargar | estudiante-03, profesor-05 |
| `GET /v1/admin/summary` | admin | Métricas, distribución por jornada, grupos recientes | admin-01 |
| `GET /v1/groups?q=&shift=&page=` | admin | Lista con búsqueda y filtro | admin-02 |
| `POST /v1/groups` | admin | Crear grupo (genera el código) | admin-03 |
| `GET/PATCH/DELETE /v1/groups/:id` | admin | Detalle, editar, eliminar (con sus materias, guías y PDFs) | admin-04, 05, 10 |
| `POST /v1/groups/:id/code` | admin | Regenerar el código (sube `code_version`) | admin-04 |
| `POST /v1/groups/:id/subjects` | admin | Crear materia con su docente | admin-06 |
| `PATCH/DELETE /v1/subjects/:id` | admin | Editar materia o cambiar de docente; eliminar | admin-07 |
| `GET /v1/teachers?q=&page=` | admin | Lista con materias y grupos asignados | admin-08 |
| `POST /v1/teachers` | admin | Registrar profesor (nombre, usuario, contraseña temporal) | admin-09 |
| `GET/PATCH/DELETE /v1/teachers/:id` | admin | Detalle con asignaciones, editar, eliminar | admin-09, 10 |
| `POST /v1/teachers/:id/password` | admin | Poner una contraseña temporal nueva | admin-09 |
| `GET /v1/teacher/subjects` | profesor | Sus materias por grupo con el conteo publicadas/borradores, más sus guías recientes | profesor-01 |
| `GET /v1/subjects/:id/guides?status=&topic=&q=` | profesor a cargo | Guías de su materia | profesor-02 |
| `POST /v1/subjects/:id/guides` | profesor a cargo | Crear guía (multipart: campos + PDF ≤ 10 MB), como borrador o publicada | profesor-03 |
| `GET/PATCH/DELETE /v1/guides/:id` | profesor a cargo | Detalle, editar (el PDF es opcional para reemplazarlo), eliminar guía y archivo | profesor-04, 05, 06 |
| `POST /v1/guides/:id/publish` | profesor a cargo | Publicar un borrador | profesor-06 |

## Subida de un PDF

1. El front manda `multipart/form-data` (`file`, `topic`, `title`, `description`, `status`) a `POST /api/v1/subjects/:id/guides`.
2. La API comprueba que `subjects.teacher_id` sea el usuario, que el archivo sea `application/pdf`, que empiece por `%PDF` y que pese ≤ 10 MB.
3. Genera el `guide_id`, sube el archivo a `guides/{group_id}/{subject_id}/{guide_id}.pdf` e inserta la fila (con `page_count` si se puede leer). Si la inserción falla, borra el archivo.

> En Vercel el body de una función tiene un límite de 4,5 MB. Si se queda corto, la subida pasa a `createSignedUploadUrl` (ver ADR 0005).

## Primer admin

El registro público está desactivado (Supabase → Authentication → Providers → Email → desactiva *Allow new users to sign up*). Para crear el primer admin:
1. Supabase → Authentication → *Add user* con correo `<usuario>@staff.censaguias.app`, una contraseña y *Auto confirm*.
2. SQL editor: `insert into public.profiles (id, username, full_name, role) select id, '<usuario>', '<Nombre>', 'admin' from auth.users where email = '<usuario>@staff.censaguias.app';`

## Despliegue (objetivo)

- `apps/web` y `apps/api` en Vercel como dos proyectos (raíz `apps/web` y `apps/api`). La variable `API_URL` del web apunta a la URL de la API.
- Supabase: un proyecto para producción. Cada dev usa `supabase start` en local o un proyecto propio.
