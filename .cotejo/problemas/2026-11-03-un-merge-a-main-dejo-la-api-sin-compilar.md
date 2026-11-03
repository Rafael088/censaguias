---
id: pro-f06p
fecha: 2026-11-03
temas: []
estado: resuelto
solucion: Revisar que `npm test` de la API corra antes de mergear; un merge que deja 0 tests no es un merge
origen: 01-Proyectos/CensaGuias/CensaGuias.md#🪤 Problemas y soluciones:be42a8f3
---
# Un merge a main dejó la API sin compilar

Un merge a `main` dejó la API sin compilar

**Causa:** El conflicto de `app.ts` y `supabase.ts` se resolvió pegando las dos versiones

**Solución:** Revisar que `npm test` de la API corra antes de mergear; un merge que deja 0 tests no es un merge
