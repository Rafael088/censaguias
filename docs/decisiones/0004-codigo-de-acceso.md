# 0004 · Estudiantes sin cuenta: código de acceso por grupo

**Estado:** Aceptada (2026-10-20)

**Contexto.** Hoy los estudiantes reciben un enlace de Drive. Pedirles registro sería fricción; basta con que el admin comparta un código por grupo.

**Decisión.**
- Al crear un grupo la API genera un código `XXXX-XXXX` con un alfabeto de 31 caracteres sin ambiguos (sin `0 O 1 I L`) usando `crypto.randomInt` → ~8,5·10¹¹ combinaciones. Único en la tabla (si choca, se reintenta).
- El estudiante lo escribe como quiera (minúsculas, sin guion, con espacios) y se normaliza (`normalizeAccessCode`).
- Al canjearlo recibe una cookie `httpOnly` con un JWT HS256 (`sub` = `group_id`, `v` = `code_version`) válido 30 días.
- Regenerar el código o archivar el grupo sube `code_version` → todas las sesiones anteriores caen.
- `POST /v1/access` limita intentos por IP (tarea API-03) para que no se pueda adivinar el código a fuerza bruta.

**Consecuencias.**
- Quien tenga el código ve las guías del grupo: es un acceso compartido, no personal. Aceptable para material de clase; no sirve para contenido privado por estudiante.
- No sabemos qué estudiante descargó qué. Si hace falta, se añade en otra versión.
