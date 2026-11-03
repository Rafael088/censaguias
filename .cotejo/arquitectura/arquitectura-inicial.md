---
id: arq-um45
temas: [arquitectura]
actualizado: 2026-11-03
---
# Arquitectura inicial

Navegador → apps/web (Next) → rewrite /api/* → apps/api (Hono) → Supabase. El front usa el cliente tipado hc<AppType> y no duplica tipos. El estudiante lleva una cookie httpOnly firmada (group_id + code_version); el staff, un Bearer de Supabase. Los PDFs van en el bucket privado guides/{grupo}/{materia}/{guia}.pdf y se sirven con URL firmada de 60 s. Detalle en docs/ARQUITECTURA.md.

## Piezas

| Capa | Pieza | Qué es | Tecnología | Tareas |
| --- | --- | --- | --- | --- |
| ve | Acceso del estudiante | Donde el estudiante entra con el código de su grupo y ve sus guías | Next.js | cotejo-pf1qvd, cotejo-4483mq |
| ve | Acceso del staff | La entrada de profesores y administradores, con su contraseña | Next.js | cotejo-8abum3 |
| ve | Panel del administrador | Resumen, grupos, materias y profesores del colegio | Next.js | cotejo-a9apwa, cotejo-gzhkys, cotejo-kaajsn |
| ve | Panel del profesor | Sus materias y la subida de guías arrastrando el PDF | Next.js | cotejo-q5pk60, cotejo-8kozh4 |
| ve | Diseño común | Los botones, tablas y estados de carga, vacío y error que comparten todas las pantallas | React | cotejo-au06nw, cotejo-q3m7cn |
| hace | Permisos | Quién puede ver y cambiar qué: estudiante, profesor o administrador | Hono | cotejo-n2sqhb, cotejo-k39a3x |
| hace | Grupos y materias | Crear grupos con su código y repartir las materias entre profesores | Hono | cotejo-dotf1c, cotejo-8s7ssr, cotejo-79tovn |
| hace | Guías | Subir una guía con su PDF y entregársela a cada quien según su rol | Hono | cotejo-rjarjl, cotejo-d9ihap, cotejo-00sn61, cotejo-8kozh4, cotejo-rgsj6s |
| hace | Límite de intentos | Frena a quien prueba códigos o contraseñas sin parar | Hono | cotejo-5bwlkv |
| guarda | Base de datos | Grupos, materias, profesores y guías | Supabase (Postgres) | cotejo-8e9ygu |
| guarda | PDFs de las guías | Los archivos, privados, que se abren con un enlace que dura 60 segundos | Supabase Storage | cotejo-rjarjl |
| conecta | Cuentas del staff | El inicio de sesión de profesores y administradores | Supabase Auth | cotejo-8e9ygu, cotejo-79tovn |
| conecta | Publicación | Donde vive la app en internet, web y API por separado | Vercel | cotejo-bqxov3, cotejo-cw9mbx |

## Cómo se abre

- comando: npm run dev
- url: http://localhost:3000
- qué esperar: la página de acceso del estudiante, con el campo del código que empieza por CENSA- (la API arranca a la vez por detrás)
