# 0003 · La API es la única puerta a Supabase

**Estado:** Aceptada (2026-10-20)

**Contexto.** Los estudiantes no tienen usuario en Supabase Auth, así que las políticas RLS basadas en `auth.uid()` no les sirven. Mantener a la vez reglas en RLS y en la API duplica la lógica de permisos.

**Decisión.**
- RLS activado en todas las tablas y **sin políticas** para `anon` ni `authenticated`: desde el navegador no se puede leer ni escribir nada.
- La API usa `service_role` y decide los permisos en sus middlewares (`requireStaff`, `requireStudent`) y en cada ruta.
- El front solo usa Supabase para Auth del staff (login, recuperar contraseña) y manda el `access_token` a la API como Bearer.

**Consecuencias.**
- Los permisos están en un solo sitio y se pueden testear con Vitest.
- Un olvido en una ruta es un agujero: toda ruta nueva necesita su middleware y, si toca una asignatura, comprobar `subject_teachers`. Esto se revisa en cada PR.
- Si la `anon key` se filtra no da acceso a datos.
