// Inicio del área de administración (Figma `admin-01-resumen`: «Resumen académico»).
// El contenido —métricas, grupos recientes y accesos— es WEB-04.
export default function AdminResumen() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
      <h1 className="text-section font-semibold text-ink">Resumen académico</h1>
      <p className="text-body text-muted">Una vista general de tus grupos, docentes y material publicado.</p>
    </div>
  );
}
