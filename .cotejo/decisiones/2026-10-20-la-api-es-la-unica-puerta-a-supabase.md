---
id: dec-zo7q
fecha: 2026-10-20
temas: [arquitectura, datos, seguridad]
estado: propuesta
autor: agente
---
# La API es la única puerta a Supabase

El navegador nunca toca tablas ni Storage: todo pasa por Hono con service_role, y los permisos se comprueban en sus middlewares. RLS está activo y sin políticas públicas. Motivo: los estudiantes no tienen usuario de Auth. Ver docs/decisiones/0003.
