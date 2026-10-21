# Planning · MVP v0.1.0

**Objetivo:** un admin crea un grupo con sus asignaturas y profesores, los profesores suben guías en PDF y los estudiantes las abren con el código del grupo, desde el celular, sin Drive.

**Listo cuando:** el recorrido completo de la sección *Prueba de aceptación* funciona en producción.

Cada tarea es un issue en GitHub con el mismo ID en el título y la etiqueta de su área, dentro del milestone **v0.1.0**.

## Ya hecho (en el commit inicial)

- Monorepo (`apps/web`, `apps/api`, `packages/shared`), docs y ADRs.
- Migración inicial: tablas, RLS, trigger de perfiles, bucket `guides`.
- API: `/health`, `POST/DELETE /v1/access` (canje de código y cookie), middlewares `requireStaff` y `requireStudent`, generador de códigos con tests.
- Web: pantalla de ingreso de código y cliente tipado `api`.
- CI: typecheck + tests en cada PR.

## Dentro y fuera del MVP

| Dentro | Fuera (después de 0.1.0) |
|---|---|
| Un admin (o varios), creados a mano | Registro público, varias instituciones |
| Grupos, asignaturas, profesores, guías PDF | Otros formatos (Word, video, enlaces) |
| Código por grupo, regenerable | Cuentas de estudiante, saber quién descargó |
| Ver y descargar PDF | Visor con anotaciones, búsqueda dentro del PDF |
| Archivar grupo | Papelera / restaurar guías, versiones de una guía |
| Español | Otros idiomas, notificaciones |

## Tareas

Estimación: **S** ≤ medio día · **M** ≈ 1 día · **L** 2–3 días.

### Infra

| ID | Tarea | Depende de | Tam. |
|---|---|---|---|
| INF-01 | Crear el proyecto de Supabase, aplicar la migración, desactivar el registro público, crear el primer admin y compartir las variables (gestor de secretos del equipo, no el chat). | — | S |
| INF-02 | Despliegue: `apps/web` y `apps/api` en Vercel, variables por entorno, `API_URL` del web → API. Previews en cada PR. | INF-01 | M |

### API (`apps/api`)

| ID | Tarea | Depende de | Tam. |
|---|---|---|---|
| API-01 | `GET /v1/me`. Helper de tests: app con Supabase simulado y tokens falsos de admin/profesor/estudiante. | INF-01 | M |
| API-02 | Grupos: `GET/POST /v1/groups`, `PATCH /v1/groups/:id` (nombre, archivar), `POST /v1/groups/:id/code` (regenerar, sube `code_version`). Reintentar si el código choca. | API-01 | M |
| API-03 | Límite de intentos en `POST /v1/access` (p. ej. 10/min por IP) con respuesta 429. | — | S |
| API-04 | Asignaturas: `GET/POST /v1/groups/:id/subjects`, `PATCH/DELETE /v1/subjects/:id`, `PUT /v1/subjects/:id/teachers`. | API-02 | M |
| API-05 | Subir guía: `POST /v1/subjects/:id/guides` (multipart, PDF ≤ 20 MB, firma `%PDF`), limpieza si falla. Probar el límite real de Vercel y decidir si cambiar a subida firmada (ADR 0005). | API-04 | L |
| API-06 | Guías: `GET /v1/subjects/:id/guides`, `PATCH/DELETE /v1/guides/:id` (borra también el archivo). | API-05 | S |
| API-07 | Estudiante: `GET /v1/student/group`, `GET /v1/student/subjects/:id/guides`, `GET /v1/guides/:id/download` (URL firmada 60 s, sirve también a staff). | API-05 | M |
| API-08 | Profesores: `GET /v1/teachers`, `POST /v1/teachers` (invitación por correo), `GET /v1/teacher/subjects`. | API-01 | M |
| API-09 | Tests de permisos: profesor no toca asignaturas ajenas; estudiante no ve otro grupo; código regenerado invalida la sesión; grupo archivado no entra. | API-04, 06, 07 | M |

### Web (`apps/web`)

| ID | Tarea | Depende de | Tam. |
|---|---|---|---|
| WEB-01 | Leer el Figma: tokens en `@theme`, componentes base (botón, input, tarjeta, lista, diálogo, toast, vacío) y completar `docs/DISENO.md`. **Bloquea el resto de la UI.** | — | M |
| WEB-02 | Estudiante: ingreso de código con el diseño final, `/grupo` (asignaturas), `/grupo/[subjectId]` (guías, abrir/descargar), salir. | WEB-01, API-07 | M |
| WEB-03 | Staff: `/login` con Supabase Auth, recuperar contraseña, aceptar invitación, guard por rol, layout de admin y de profesor. Enviar el token como Bearer en `api`. | WEB-01, API-01 | M |
| WEB-04 | Admin · grupos: lista, crear (mostrar el código con botón copiar), archivar. | WEB-03, API-02 | M |
| WEB-05 | Admin · detalle de grupo: código (copiar, regenerar con confirmación), asignaturas (crear, editar, borrar), asignar profesores. | WEB-04, API-04 | L |
| WEB-06 | Admin · profesores: lista e invitar. | WEB-03, API-08 | S |
| WEB-07 | Profesor: mis asignaturas, guías de una asignatura, subir PDF con progreso y validación de tamaño/tipo, editar título, borrar con confirmación. | WEB-03, API-06, API-08 | L |
| WEB-08 | Pulido: estados de carga, vacío y error en todas las pantallas; revisión móvil y accesibilidad (teclado, contraste, labels). | WEB-02…07 | M |

### Cierre

| ID | Tarea | Depende de | Tam. |
|---|---|---|---|
| REL-01 | Prueba de aceptación en producción, corregir lo que salga, etiquetar `v0.1.0` y escribir las notas de la versión. | todo | S |

## Orden sugerido (para repartir en paralelo)

```
Semana 1   INF-01 → API-01 → API-02 → API-04        WEB-01 → WEB-03          API-03
Semana 2   API-05 → API-06 → API-07   API-08        WEB-02   WEB-04 → WEB-05   INF-02
Semana 3   API-09                                   WEB-06   WEB-07 → WEB-08   REL-01
```

Tres frentes que casi no se pisan: **API**, **UI de estudiante/admin**, **UI de profesor + infra**.

## Prueba de aceptación

1. El admin inicia sesión, crea el grupo «10A» y ve su código.
2. Crea las asignaturas «Matemáticas» y «Química», invita a un profesor y lo asigna a Matemáticas.
3. El profesor acepta la invitación, entra, ve solo Matemáticas y sube dos PDF.
4. El profesor no puede subir nada a Química (ni por la UI ni llamando a la API).
5. Un estudiante, desde el celular, escribe el código en minúsculas y sin guion, ve las dos asignaturas y abre un PDF de Matemáticas.
6. El admin regenera el código: el estudiante, al recargar, vuelve a la pantalla de código; el código nuevo funciona.
7. Diez códigos erróneos seguidos desde la misma IP devuelven 429.

## Definición de hecho (cada tarea)

- `npm run typecheck && npm test` en verde en el PR.
- Toda ruta nueva tiene middleware de auth y al menos un test de «no autorizado».
- La UI sigue el Figma y se ve bien a 375 px de ancho.
- Si cambió el contrato de la API, `docs/ARQUITECTURA.md` está al día.
