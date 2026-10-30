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
