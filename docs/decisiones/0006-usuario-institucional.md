# 0006 · El staff entra con usuario institucional y la cuenta la crea el admin

**Estado:** Aceptada (2026-10-20)

**Contexto.** En el Figma, profesores y administradores entran con **usuario institucional** (`laura.martinez`) y contraseña, no con correo. El admin registra al profesor con nombre, usuario y una **contraseña temporal** que le entrega en persona. Si alguien olvida la contraseña, "solicita restablecimiento al administrador". Supabase Auth, en cambio, necesita un correo.

**Decisión.**
- Cada usuario de staff tiene en Auth un **correo sintético**: `<usuario>@<STAFF_EMAIL_DOMAIN>` (por defecto `staff.censaguias.app`). El dominio no necesita existir y nunca se manda correo.
- Registrar un profesor (`POST /v1/teachers`, solo admin) hace `auth.admin.createUser({ email, password, email_confirm: true })` y luego inserta en `profiles` el usuario, el nombre y `role = 'teacher'`. Si la inserción falla, se borra el usuario de Auth.
- Login: `POST /v1/auth/login { username, password }`. La API traduce el usuario a correo, llama a `signInWithPassword` y devuelve los tokens. El front los guarda con `supabase.auth.setSession()`. El dominio sintético vive solo en la API.
- El rol solo sale de `profiles.role`. El primer admin se crea a mano (ver ARQUITECTURA.md); no hay registro público.
- Restablecer la contraseña lo hace el admin (`POST /v1/teachers/:id/password`). No hay correo de recuperación.
- Desactivar a un profesor (`profiles.active = false`) corta su acceso aunque su token siga vigente, porque `requireStaff` lo comprueba en cada request.

**Consecuencias.**
- No hay "olvidé mi contraseña" por correo. Es lo que pide el diseño, pero el admin queda como único punto de recuperación.
- Hay que desactivar "Allow new users to sign up" en Supabase Auth, para que nadie cree cuentas con el cliente anon.
- La contraseña temporal no obliga a cambiarla en el primer ingreso. Queda para una versión posterior.
