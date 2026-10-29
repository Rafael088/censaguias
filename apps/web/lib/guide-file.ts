import { getStudentGuideFile } from "./student";

/** URL del PDF para abrirlo o verlo (firma de 60 s que genera la API). */
export async function urlDeGuia(id: string): Promise<string | null> {
  const file = await getStudentGuideFile(id, false);
  return file?.url ?? null;
}

/** Abre la guía en una pestaña nueva. */
export async function abrirGuia(id: string): Promise<void> {
  const file = await getStudentGuideFile(id, false);
  if (!file) return;
  window.open(file.url, "_blank", "noopener,noreferrer");
}

/**
 * Descarga el PDF. El nombre solo se aplica en el mismo origen (los archivos de
 * muestra); la URL firmada real lleva `Content-Disposition` y descarga igual.
 */
export async function descargarGuia(id: string): Promise<void> {
  const file = await getStudentGuideFile(id, true);
  if (!file) return;
  const link = document.createElement("a");
  link.href = file.url;
  link.download = file.fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
