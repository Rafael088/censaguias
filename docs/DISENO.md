# Diseño

**Figma (fuente de verdad de la UI):** https://www.figma.com/design/gEdPfgUUCNhPEhcsQRK7wf/Sin-t%C3%ADtulo?node-id=0-1

> ⚠️ Al crear el repo no se pudieron leer las pantallas del Figma (la cuenta conectada no tenía acceso). Los colores de `apps/web/app/globals.css` son **provisionales**. La tarea **WEB-01** pasa los estilos (colores, tipografía, radios, espaciado) del Figma a `@theme` y completa esta página con la lista de pantallas.

## Cómo implementar una pantalla

1. Abre el frame en Figma. Si tu agente tiene el MCP de Figma, pásale la URL del frame (con `node-id`).
2. Usa los tokens de `@theme` (`bg-brand`, `text-muted`…), no hex sueltos.
3. Reutiliza los componentes de `apps/web/components/` antes de crear uno nuevo.
4. Móvil primero: la mayoría de estudiantes entra desde el celular.
5. Texto en español, tuteo, frases cortas.

## Pantallas del MVP

| Área | Pantalla | Ruta |
|---|---|---|
| Estudiante | Ingresar código | `/` |
| Estudiante | Mi grupo (asignaturas) | `/grupo` |
| Estudiante | Guías de una asignatura | `/grupo/[subjectId]` |
| Staff | Login | `/login` |
| Admin | Grupos (lista + crear) | `/admin/grupos` |
| Admin | Detalle de grupo (código, asignaturas, profesores) | `/admin/grupos/[id]` |
| Admin | Profesores (lista + invitar) | `/admin/profesores` |
| Profesor | Mis asignaturas | `/profesor` |
| Profesor | Guías de una asignatura (subir, editar, borrar) | `/profesor/[subjectId]` |

Cuando WEB-01 lea el Figma, ajusta esta tabla al nombre real de cada frame.
