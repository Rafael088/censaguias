---
id: arq-um45
temas: [arquitectura]
actualizado: 2026-10-20
---
# Arquitectura inicial

Navegador → apps/web (Next) → rewrite /api/* → apps/api (Hono) → Supabase. El front usa el cliente tipado hc<AppType> y no duplica tipos. El estudiante lleva una cookie httpOnly firmada (group_id + code_version); el staff, un Bearer de Supabase. Los PDFs van en el bucket privado guides/{grupo}/{materia}/{guia}.pdf y se sirven con URL firmada de 60 s. Detalle en docs/ARQUITECTURA.md.
