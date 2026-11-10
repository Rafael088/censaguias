---
id: pro-94z7
fecha: 2026-11-03
temas: []
estado: resuelto
solucion: Rellenarlas con `''` (`coalesce`) y crear los usuarios por la API de Auth o el dashboard, no con `insert` a mano
origen: 01-Proyectos/CensaGuias/CensaGuias.md#🪤 Problemas y soluciones:f5401bb3
---
# La Auth devolvía 500 Database error querying schema en el login y al listar usuarios

La Auth devolvía 500 `Database error querying schema` en el login y al listar usuarios

**Causa:** Un usuario se había insertado a mano en `auth.users` con columnas de token en `NULL` (`email_change`, `confirmation_token`, `recovery_token`, `email_change_token_new`, `phone_change`, `phone_change_token`, `reauthentication_token`, `email_change_token_current`, y `created_at`/`updated_at` en `test@test.com`); GoTrue las lee como `string` no nulo

**Solución:** Rellenarlas con `''` (`coalesce`) y crear los usuarios por la API de Auth o el dashboard, no con `insert` a mano
