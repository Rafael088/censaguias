const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * «14 oct 2026», como en el Figma.
 * Se lee la fecha ISO tal cual (YYYY-MM-DD) para que no cambie de día según la zona horaria.
 */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** «1,8 MB» — coma decimal, como en el Figma. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** «PDF · 1,8 MB · 14 oct 2026», la línea de archivo de las tarjetas de guía. */
export function fileMeta(sizeBytes: number, publishedAt: string): string {
  return `PDF · ${formatBytes(sizeBytes)} · ${formatDate(publishedAt)}`;
}
