# Planning · MVP v0.1.0

**Objetivo:** el admin crea un grupo CLEI con sus materias y profesores, los profesores publican guías en PDF y los estudiantes las abren con el código del grupo, desde el celular, sin Drive.

**Listo cuando:** el recorrido completo de la *Prueba de aceptación* funciona en producción y las pantallas coinciden con el Figma (`docs/diseno/`).

Cada tarea es un issue de GitHub con el mismo ID en el título, la etiqueta de su área y el milestone **v0.1.0**. La columna *Pantallas* indica qué imágenes de `docs/diseno/` hay que seguir.

## Ya hecho

- Monorepo (`apps/web`, `apps/api`, `packages/shared`), docs, ADRs e imágenes del Figma.
- Migración inicial: grupos CLEI, materias con docente, guías con estado, RLS y bucket `guides` de 10 MB.
- API: `/health`, `GET /v1/me` (perfil, rol y materias del profesor), `POST/DELETE /v1/access` (canje del código y cookie), `POST /v1/auth/login` (usuario institucional), los middlewares `requireStaff` y `requireStudent`, y el generador de códigos con tests.
- Tests de API: helper con Supabase simulado en memoria y sesiones falsas de admin, profesor y estudiante (`apps/api/src/test/`).
- Web del staff (WEB-03): pantalla `/ingresar` con pestañas y estado de error, sesión guardada con Supabase Auth (`setSession` y refresco), el `Bearer` en el cliente tipado `api`, guard por rol con `GET /v1/me` y los layouts de admin y profesor con barra lateral, cabecera y cerrar sesión.
- Web: tokens del sistema de diseño (colores, Inter, escala, radios, foco), un formulario de código provisional y el cliente tipado `api`.
- CI: typecheck y tests en cada PR.

## Dentro y fuera del MVP

| Dentro | Fuera (después de 0.1.0) |
|---|---|
| Admin creado a mano; profesores registrados por el admin | Registro público, varias instituciones |
| Grupos CLEI, materias (un docente), guías PDF con borrador/publicada | Otros formatos (Word, video, enlaces), varias versiones de una guía |
| Código por grupo, regenerable | Cuentas de estudiante, saber quién descargó |
| Abrir, descargar y vista previa de la primera página | Visor con anotaciones, búsqueda dentro del PDF |
| Contraseña temporal; el admin la restablece | Recuperación por correo, cambio obligatorio de contraseña en el primer ingreso |
| Español, web y móvil | Otros idiomas, notificaciones, app nativa |

## Tareas

Estimación: **S** ≤ medio día · **M** ≈ 1 día · **L** 2–3 días.

### Infra

| ID | Tarea | Depende de | Tam. |
|---|---|---|---|
| INF-01 | Crear el proyecto de Supabase, aplicar la migración, desactivar el registro público, crear el primer admin (ver ARQUITECTURA.md) y un `seed.sql` con los datos de ejemplo del Figma. Compartir las variables por el gestor de secretos del equipo, no por el chat. | — | S |
| INF-02 | Despliegue: `apps/web` y `apps/api` en Vercel, variables por entorno y `API_URL` del web apuntando a la API. Previews en cada PR. | INF-01 | M |

### API (`apps/api`)

| ID | Tarea | Depende de | Tam. |
|---|---|---|---|
| API-01 | `GET /v1/me`. Helper de tests: una app con Supabase simulado y sesiones falsas de admin, profesor y estudiante. | INF-01 | M |
| API-02 | Grupos y resumen: `GET /v1/admin/summary`, `GET/POST /v1/groups` (búsqueda, filtro por jornada, paginación), `GET/PATCH/DELETE /v1/groups/:id` (al eliminar, borrar también los PDFs) y `POST /v1/groups/:id/code`. Reintentar si el código choca. | API-01 | L |
| API-03 | Límite de intentos en `POST /v1/access` y `POST /v1/auth/login` (p. ej. 10/min por IP, y por usuario en el login), con respuesta 429. | — | S |
| API-04 | Materias: `POST /v1/groups/:id/subjects` (con docente) y `PATCH/DELETE /v1/subjects/:id` (incluye cambiar de docente). | API-02, API-08 | M |
| API-05 | Crear guía: `POST /v1/subjects/:id/guides` (multipart, PDF ≤ 10 MB que empiece por `%PDF`, `page_count`, borrador o publicada). Si falla, limpiar. Probar el límite real de Vercel y decidir si se cambia a subida firmada (ADR 0005). | API-04 | L |
| API-06 | Guías del profesor: `GET /v1/teacher/subjects`, `GET /v1/subjects/:id/guides` (filtros), `GET/PATCH/DELETE /v1/guides/:id` (reemplazar el PDF) y `POST /v1/guides/:id/publish`. | API-05 | M |
| API-07 | Estudiante: `GET /v1/student/group`, `GET /v1/student/subjects/:id/guides`, `GET /v1/student/guides/:id` y `GET /v1/guides/:id/file` (URL firmada de 60 s, también para el staff; un estudiante solo recibe guías publicadas). | API-05 | M |
| API-08 | Profesores: `GET/POST /v1/teachers` (crear el usuario de Auth y el perfil; si falla, deshacer), `GET/PATCH/DELETE /v1/teachers/:id` y `POST /v1/teachers/:id/password`. | API-01 | M |
| API-09 | Tests de permisos: un profesor no toca materias ajenas; un estudiante no ve otro grupo ni los borradores; un código regenerado o un grupo eliminado invalidan la sesión; un profesor desactivado no entra. | API-04, 06, 07 | M |

### Web (`apps/web`)

| ID | Tarea | Pantallas | Depende de | Tam. |
|---|---|---|---|---|
| WEB-01 | Componentes base del sistema (lista en DISENO.md): botón, campo, selector, buscador, pestañas de filtro, chip de estado, tarjetas, tabla, aviso, diálogo, estado vacío, cabecera de grupo, barra lateral y navegación inferior. Una página `/dev/componentes` para verlos. **Bloquea el resto de la UI.** | `00-fundamentos-*` | — | M |
| WEB-02 | Estudiante (escritorio y móvil): acceso por código (normal y error), mis materias, guías de una materia con filtro por tema, detalle con vista previa (`pdfjs-dist`), abrir/descargar, mi grupo, salir/cambiar código, materia vacía. | `acceso-estudiante*`, `estudiante-*`, `movil-estudiante` | WEB-01, API-07 | L |
| WEB-03 | Staff: `/ingresar` con pestañas Profesor/Administrador y error, `setSession` y refresco, envío del Bearer en `api`, guard por rol, layout con barra lateral y cabecera (nombre y rol), cerrar sesión. | `acceso-staff*` | WEB-01, API-01 | M |
| WEB-04 | Admin · resumen y grupos: resumen académico, lista con búsqueda y filtro, crear, editar y regenerar código (con aviso), eliminar con confirmación. | `admin-01…04`, `admin-10` | WEB-03, API-02 | L |
| WEB-05 | Admin · detalle de grupo y materias: código con "Copiar", tabla de materias y docentes, crear materia y asignar profesor, editar o cambiar de docente, eliminar. | `admin-05…07` | WEB-04, API-04 | M |
| WEB-06 | Admin · profesores: lista con búsqueda, registrar (contraseña temporal), detalle con asignaciones, editar, restablecer contraseña, eliminar con confirmación. | `admin-08`, `admin-09`, `admin-10` | WEB-03, API-08 | M |
| WEB-07 | Profesor: inicio ("Hola, Laura"), guías de una materia con filtros, crear guía (arrastrar PDF, guardar borrador o publicar), editar (reemplazar PDF), detalle con vista previa, publicar y eliminar con confirmación, estado vacío. | `profesor-*` | WEB-03, API-06 | L |
| WEB-08 | Pulido: estados de carga, vacío y error en todas las pantallas; revisión a 390 px y 1440 px; accesibilidad (teclado, foco de 2 px, áreas de 44 px, etiquetas). | todas | WEB-02…07 | M |

### Cierre

| ID | Tarea | Depende de | Tam. |
|---|---|---|---|
| REL-01 | Prueba de aceptación en producción, corregir lo que salga, etiquetar `v0.1.0` y escribir las notas de la versión. | todo | S |

## Orden sugerido (para repartir en paralelo)

```
Semana 1   INF-01 → API-01 → API-08 → API-02        WEB-01 → WEB-03          API-03
Semana 2   API-04 → API-05 → API-06 → API-07        WEB-04 → WEB-05   WEB-06   INF-02
Semana 3   API-09                                   WEB-02   WEB-07 → WEB-08   REL-01
```

Hay tres frentes que casi no se pisan: **API**, **UI de admin y staff** y **UI de estudiante y profesor más infra**.

## Prueba de aceptación

1. El admin entra con su usuario institucional, crea el grupo CLEI IV · A · Mañana · 2026 y ve un código `CENSA-4AM-` más 3 caracteres.
2. Registra a la profesora `laura.martinez` con una contraseña temporal. Crea las materias Matemáticas (con Laura) y Ciencias Naturales (con otro docente).
3. Laura entra, ve solo Matemáticas, sube un PDF como borrador y otro publicado, y después publica el borrador.
4. Laura no puede crear guías en Ciencias Naturales, ni desde la UI ni llamando a la API.
5. Un estudiante, desde el celular, escribe solo los 6 caracteres del código, en minúsculas y sin guiones, ve las dos materias y solo las guías publicadas. Abre y descarga un PDF de Matemáticas.
6. El admin regenera el código: al recargar, el estudiante vuelve a la pantalla de código, y el código nuevo funciona.
7. Diez códigos erróneos seguidos desde la misma IP devuelven 429.
8. El admin elimina a Laura: Matemáticas queda sin docente y las guías publicadas siguen visibles para el grupo.

## Definición de hecho (cada tarea)

- `npm run typecheck && npm test` en verde en el PR.
- Toda ruta nueva tiene middleware de auth y al menos un test de «no autorizado».
- Las pantallas coinciden con su imagen de `docs/diseno/` a 390 px y a 1440 px, con los textos del Figma.
- Si cambió el contrato de la API, `docs/ARQUITECTURA.md` está al día.
