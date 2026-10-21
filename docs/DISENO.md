# Diseño

**Figma:** https://www.figma.com/design/gEdPfgUUCNhPEhcsQRK7wf/Sin-t%C3%ADtulo?node-id=0-1
**Copia en el repo:** [`docs/diseno/`](diseno/). Hay una imagen por pantalla, exportada el 2026-10-20. Si tu agente no tiene acceso al Figma, **léele la imagen de la pantalla que vas a construir**. Si el Figma cambia, vuelve a exportar las imágenes.

## Fundamentos

Ver [`00-fundamentos-1.png`](diseno/00-fundamentos-1.png) y [`00-fundamentos-2.png`](diseno/00-fundamentos-2.png). Los tokens ya están en `apps/web/app/globals.css` (`@theme`).

| Token | Valor | Clase Tailwind |
|---|---|---|
| Principal | `#00843D` | `bg-primary`, `text-primary`, `border-primary` |
| Texto | `#064A2B` | `text-ink` |
| Tinte | `#E8F5ED` | `bg-tint` |
| Superficie | `#FFFFFF` | `bg-surface` |
| Tipografía | Inter | `font-sans` (cargada con `next/font`) |
| Escala | 12 · 13 · 14 · 16 · 20 · 24 · 32 · 40 px | `text-meta` 13 · `text-label` 14/600 · `text-body` 16/400 (1,45) · `text-section` 24/600 |
| Espaciado | retícula de 8 px (8 · 16 · 24 · 32 · 48) | `p-2 p-4 p-6 p-8 p-12` |
| Radios | control 8 · tarjeta 12 · panel 16 | `rounded-control` · `rounded-card` · `rounded-panel` |

Reglas del sistema:
- **Solo verdes y blanco.** No hay rojo para errores: un error lleva un icono `!`, un borde de 2 px y un texto que explica qué pasó y cómo reintentar.
- Botones de al menos **46 px** de alto, separados 8 px. Hay cuatro variantes: primario (relleno), secundario (borde), texto y deshabilitado (fondo tinte).
- Iconos lineales de 20–24 px. **Toda acción relevante lleva una etiqueta visible**, no solo el icono. El estilo encaja con [Lucide](https://lucide.dev).
- Foco visible de 2 px. Áreas táctiles de al menos 44 × 44 px. Texto principal de 15–16 px.
- **Web:** 1440 px, barra lateral de 244 px y márgenes de 40 px. **Móvil:** 390 px, márgenes de 24 px, una columna y navegación inferior (*Materias* · *Mi grupo*). El móvil reorganiza el contenido, no encoge el escritorio.
- Logo: por ahora es un hueco reservado ("Logo oficial de CENSA"). No inventes un logo.
- Datos de ejemplo del Figma: CLEI IV · A · Mañana, Laura Martínez (`laura.martinez`), Matemáticas / Lengua Castellana / Ciencias Naturales. Úsalos en el seed.

## Componentes que se repiten (crear en `apps/web/components/`)

Botón (4 variantes) · Campo con etiqueta, ayuda y error · Selector · Buscador · Filtro por pestañas (Todas / Mañana / Noche / Sabatina; Todos los temas / Álgebra…) · Chip de estado (✓ Publicada · Borrador) · Tarjeta de materia (icono, nombre, descripción, docente, nº de guías y flecha) · Tarjeta de guía (tema, título, descripción, PDF · tamaño · fecha y acciones) · Tabla con acciones de texto (Ver · Editar · Eliminar) · Aviso informativo/éxito (fondo tinte, icono, título y texto) · Diálogo de confirmación ("Antes de continuar…") · Estado vacío (icono en círculo, título, texto y botón) · Cabecera de grupo (CLEI IV · A, jornada · año y chip con el código) · Barra lateral por rol · Navegación inferior en móvil · Zona para arrastrar el PDF · Vista previa del PDF (primera página).

## Pantallas

| Área | Pantalla | Imagen | Ruta |
|---|---|---|---|
| Acceso | Estudiante: código (normal y error) | `acceso-estudiante*.png`, `movil-estudiante.png` | `/` |
| Acceso | Staff: pestañas Profesor / Administrador, usuario institucional y contraseña (normal y error) | `acceso-staff*.png` | `/ingresar` |
| Admin | Resumen académico (métricas, distribución por jornada, accesos rápidos, grupos recientes) | `admin-01` | `/admin` |
| Admin | Grupos CLEI (buscador, filtro por jornada, tabla) | `admin-02` | `/admin/grupos` |
| Admin | Crear grupo | `admin-03` | `/admin/grupos/nuevo` |
| Admin | Editar grupo + regenerar código | `admin-04` | `/admin/grupos/[id]/editar` |
| Admin | Detalle de grupo (código, copiar, materias y docentes) | `admin-05` | `/admin/grupos/[id]` |
| Admin | Crear materia y asignar profesor | `admin-06` | `/admin/grupos/[id]/materias/nueva` |
| Admin | Editar materia / cambiar docente | `admin-07` | `/admin/materias/[id]/editar` |
| Admin | Profesores (lista) | `admin-08` | `/admin/profesores` |
| Admin | Detalle de profesor (datos, asignaciones) + registrar profesor | `admin-09` | `/admin/profesores/[id]`, `/admin/profesores/nuevo` |
| Admin | Confirmaciones (eliminar grupo / profesor) y búsqueda vacía | `admin-10` | diálogos |
| Profesor | Hola, Laura (mis materias por grupo, guías recientes) | `profesor-01` | `/profesor` |
| Profesor | Guías de una materia (filtro Todas/Publicadas/Borradores, temas) | `profesor-02` | `/profesor/materias/[id]` |
| Profesor | Crear guía (destino, tema, título, descripción, PDF; borrador o publicar) | `profesor-03` | `/profesor/guias/nueva` |
| Profesor | Editar guía (reemplazar PDF) | `profesor-04` | `/profesor/guias/[id]/editar` |
| Profesor | Detalle de guía con vista previa | `profesor-05` | `/profesor/guias/[id]` |
| Profesor | Publicar / eliminar / sin guías | `profesor-06` | diálogos y vacío |
| Estudiante | Mis materias (+ últimas guías publicadas) | `estudiante-01` | `/materias` |
| Estudiante | Guías de una materia (filtro por tema) | `estudiante-02` | `/materias/[id]` |
| Estudiante | Detalle de guía (vista previa, abrir y descargar) | `estudiante-03` | `/guias/[id]` |
| Estudiante | Materia sin guías | `estudiante-04` | `/materias/[id]` |
| Estudiante | Mi grupo (código, materias y docentes) | `estudiante-05` | `/mi-grupo` |
| Estudiante | Salir / cambiar código | `estudiante-06` | diálogo |

## Textos

En español y tuteando ("Ingresa", "Tus materias"). Frases cortas que dicen qué pasa y qué hacer. Copia los textos del Figma tal cual: ya están revisados.
