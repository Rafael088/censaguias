# 0004 · Estudiantes sin cuenta: código de acceso por grupo

**Estado:** Aceptada (2026-10-20)

**Contexto.** Hoy los estudiantes reciben un enlace de Drive. Pedirles registro sería fricción: basta con que la institución comparta un código por grupo. El Figma muestra códigos legibles como `CENSA-4AM-26` (CLEI IV · A · Mañana · 2026). Pero ese formato **se adivina**: con saber el CLEI, el grupo, la jornada y el año, cualquiera entra a cualquier grupo en pocos intentos. Tampoco podría regenerarse, porque saldría siempre el mismo código.

**Decisión.**
- Formato `CENSA-4AM-26-K7QX`: el prefijo legible del Figma más **4 caracteres aleatorios** de un alfabeto de 31 sin caracteres ambiguos (sin `0 O 1 I L`). Se generan con `crypto.randomInt` y dan ~923 000 combinaciones por grupo. Si el código choca con otro, se reintenta.
- Regenerar cambia el sufijo y sube `code_version`, así que todas las sesiones anteriores caen. Cambiar el grupo o la jornada **no** cambia el código, como dice el Figma.
- El estudiante puede escribirlo en minúsculas o con espacios: se normaliza (`normalizeAccessCode`). Los guiones son obligatorios ("Incluye las letras, los números y los guiones").
- Al canjearlo recibe una cookie `httpOnly` con un JWT HS256 (`sub` = `group_id`, `v` = `code_version`) válida 30 días.
- `POST /v1/access` limita los intentos por IP (API-03).

**Consecuencias.**
- Los textos del Figma muestran `CENSA-4AM-26`. En la UI el código real es más largo, así que hay que dejar ancho para él.
- Quien tenga el código ve las guías publicadas del grupo. Es un acceso compartido, no personal: vale para material de clase, no para contenido privado por estudiante.
- No sabemos qué estudiante descargó qué.
