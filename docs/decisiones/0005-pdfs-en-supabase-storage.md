# 0005 · PDFs en Supabase Storage, privados, con URL firmada

**Estado:** Aceptada (2026-10-20)

**Contexto.** Las guías son PDF de hasta 10 MB. Pueden ser borrador (solo las ve el profesor) o publicadas (las ve el grupo). Deben verlas solo quienes tengan el código del grupo.

**Decisión.**
- Bucket `guides` **privado**, solo `application/pdf`, máximo **10 MB** (lo fija el Figma), ruta `{group_id}/{subject_id}/{guide_id}.pdf`.
- Subida: el front manda el archivo a la API, que valida y lo sube con `service_role`.
- Descarga: la API comprueba el acceso (un estudiante, además, solo si la guía está publicada) y devuelve una URL firmada de 60 s. "Abrir" usa la URL en una pestaña nueva; "Descargar" la pide con `download=<file_name>`.
- Vista previa: la primera página se pinta en el navegador con `pdfjs-dist` a partir de la misma URL firmada. Al subir el PDF, la API guarda `page_count`.

**Consecuencias.**
- Un enlace compartido deja de funcionar al minuto.
- En Vercel el body de una función está limitado a ~4,5 MB. Si las guías reales pesan más, se cambia la subida a `createSignedUploadUrl` (la API firma, el navegador sube directo a Storage, la API confirma y crea la fila). Se decide en API-05 con PDFs reales.
