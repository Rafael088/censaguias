import type { ReactNode } from "react";

export interface TableColumn {
  label: string;
  className?: string;
}

/** Tabla con encabezados claros (Figma «07 / Tabla y feedback»). Se desborda con scroll horizontal. */
export function DataTable({ head, children, caption }: { head: TableColumn[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line">
            {head.map((column) => (
              <th key={column.label} scope="col" className={`px-4 py-3 text-meta font-semibold text-muted ${column.className ?? ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({ children }: { children: ReactNode }) {
  return <tr className="border-b border-line last:border-b-0 hover:bg-tint">{children}</tr>;
}

export function TableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-4 text-label text-ink ${className}`}>{children}</td>;
}

/** Acciones de texto (Figma «Ver · Editar · Eliminar»): siempre con etiqueta visible. */
export function TableActions({ actions }: { actions: { label: string; onClick: () => void }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className="min-h-11 text-label font-semibold text-primary underline underline-offset-4 hover:opacity-80"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
