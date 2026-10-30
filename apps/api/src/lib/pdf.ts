import { GUIDE_MIME, MAX_GUIDE_BYTES } from "@censaguias/shared";

/**
 * Best-effort: cuenta las páginas mirando los objetos `/Type /Page` del PDF.
 *
 * Los flujos de contenido suelen venir comprimidos, pero los objetos de página casi
 * siempre están en texto plano. Si no se puede contar, se devuelve null: la columna lo
 * admite y, para la vista previa, el front mide la página real con pdfjs.
 */
export function countPdfPages(bytes: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(bytes);
  // `/Type /Page` seguido de algo que no sea letra: excluye `/Pages` (catálogo) y `/PageXxx`.
  const pages = text.match(/\/Type\s*\/Page[^a-zA-Z]/g);
  return pages && pages.length > 0 ? pages.length : null;
}

/** El motivo por el que un archivo subido no sirve (400 mal formado, 413 demasiado grande). */
export type PdfRejection = { status: 400 | 413; error: string };

export const isPdfRejection = (r: { bytes: Uint8Array } | PdfRejection): r is PdfRejection => "error" in r;

/**
 * Valida que el archivo sea un PDF de hasta 10 MB y devuelve sus bytes, o el rechazo.
 * El tamaño y el tipo se miran antes de leer el archivo, así que un PDF gigante se
 * descarta sin cargarlo entero en memoria.
 */
export async function readPdfBytes(file: File): Promise<{ bytes: Uint8Array } | PdfRejection> {
  if (file.size > MAX_GUIDE_BYTES) return { status: 413, error: "El archivo debe pesar 10 MB o menos" };
  if (file.type !== GUIDE_MIME) return { status: 400, error: "El archivo debe ser un PDF" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  // La firma va en el contenido, no en el nombre del archivo.
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!isPdf) return { status: 400, error: "El archivo no es un PDF válido" };
  return { bytes };
}
