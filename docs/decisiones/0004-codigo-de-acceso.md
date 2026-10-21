# 0004 · Estudiantes sin cuenta: código de acceso por grupo

**Estado:** Aceptada (2026-10-20)

**Contexto.** Hoy los estudiantes reciben un enlace de Drive. Pedirles registro sería fricción: basta con que la institución comparta un código por grupo. El Figma muestra `CENSA-4AM-26` (CLEI IV · A · Mañana · 2026). Ese formato **se adivina**: con saber el grupo y el año, cualquiera entra a cualquier grupo. Tampoco se puede regenerar, porque daría siempre el mismo código. Además, el estudiante tiene que poder recordarlo.

**Decisión.**
- Formato **`CENSA-4AM-K7Q`**: `CENSA` fijo, `4AM` es su grupo (CLEI IV, A, Mañana) y `K7Q` son **3 caracteres aleatorios**. El estudiante solo tiene que recordar 6 caracteres, y 3 ya los conoce.
- El año sale del código porque ya aparece en pantalla. El identificador del grupo es **una sola letra**, para que el código mida siempre lo mismo.
- El sufijo usa un alfabeto de 31 caracteres sin ambiguos (sin `0 O 1 I L`), generado con `crypto.randomInt`: son ~30 000 combinaciones por grupo. Si el código choca con otro, se reintenta.
- **Se escribe como sea**: `4amk7q`, `4AM K7Q`, `censa-4am-k7q`… `normalizeAccessCode` lo convierte en `CENSA-4AM-K7Q`. En la UI, el campo muestra `CENSA-` fijo delante y el estudiante solo teclea `4AM-K7Q` (tarea WEB-02).
- Regenerar cambia el sufijo y sube `code_version`, así que las sesiones anteriores caen. Cambiar la jornada **no** cambia el código, como dice el Figma.
- Al canjearlo, el estudiante recibe una cookie `httpOnly` con un JWT HS256 (`sub` = `group_id`, `v` = `code_version`) válida 30 días. No tiene que volver a escribir el código en ese dispositivo.
- **El límite de intentos es obligatorio** (API-03): con 30 000 combinaciones, sin límite se adivina en minutos. Con 10 intentos por minuto por IP hacen falta días, y el admin puede regenerar el código si se filtra.

**Consecuencias.**
- Es un acceso compartido, no personal. Vale para material de clase, no para contenido privado por estudiante.
- Si en algún momento se necesita más seguridad, se sube el sufijo a 4 caracteres cambiando `ACCESS_CODE_SUFFIX_LENGTH` y el check de la migración.
