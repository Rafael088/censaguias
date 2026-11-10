"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { Dialog } from "@/components/dialog";
import { Notice } from "@/components/notice";
import { deleteDescription, deleteTeacher, firstName, type AdminTeacher } from "@/lib/teachers";

export interface TeacherDeleteDialogProps {
  teacher: AdminTeacher;
  open: boolean;
  onClose: () => void;
  /** El profesor ya no existe: la pantalla vuelve a la lista con el aviso. */
  onDeleted: () => void;
}

/**
 * Confirmación de «Eliminar profesor» (Figma `admin-10`): el título nombra al
 * docente, el texto dice qué se pierde (usuario y asignaciones, con sus materias
 * y grupos) y el aviso «Antes de continuar» marca lo que queda. El botón
 * destructivo lleva el nombre del objeto, no solo un color.
 */
export function TeacherDeleteDialog({ teacher, open, onClose, onDeleted }: TeacherDeleteDialogProps) {
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const descripcion = deleteDescription(teacher);

  async function confirmar() {
    setBorrando(true);
    setError(null);
    try {
      await deleteTeacher(teacher.id);
      setBorrando(false);
      onDeleted();
    } catch (err) {
      console.warn("[WEB-06] No se pudo eliminar al profesor:", err);
      setBorrando(false);
      setError(err instanceof Error ? err.message : "No pudimos eliminar al profesor.");
    }
  }

  function cerrar() {
    if (borrando) return; // mientras borra no se cierra: el resultado tiene que verse
    setError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={cerrar}
      title={`¿Eliminar a ${teacher.fullName}?`}
      description={descripcion}
      actions={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={borrando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={borrando}>
            {borrando ? "Eliminando…" : "Eliminar profesor"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Notice title="Antes de continuar">
          Las materias quedarán sin docente asignado. Las guías publicadas se conservan; asigna un nuevo profesor
          para administrarlas.
        </Notice>
        {error && (
          <Notice tone="error" title="No pudimos eliminar al profesor">
            {error}
          </Notice>
        )}
        <p className="text-meta text-muted">
          {firstName(teacher.fullName)} perderá el acceso al espacio docente con el usuario {teacher.username}.
        </p>
      </div>
    </Dialog>
  );
}
