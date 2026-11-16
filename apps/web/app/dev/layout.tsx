import { notFound } from "next/navigation";

/** La galería del sistema de diseño es una ayuda para desarrollar: en producción no
 *  se sirve (WEB-08b, issue #36). Next fija `NODE_ENV` en el build, así que en
 *  `next dev` la galería sigue abriéndose y en `next start` responde 404. Se mira
 *  «distinto de development» para que cualquier otro entorno (producción, un entorno
 *  sin definir) la cierre en vez de abrirla. Cubre cualquier ruta de /dev/*.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <>{children}</>;
}
