"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/button";
import { Dialog } from "@/components/dialog";
import { Notice } from "@/components/notice";
import { deleteGroup, NoStaffSession, subjectsCount, type AdminGroup } from "@/lib/admin";

export interface GroupDeleteDialogProps {
  group: AdminGroup;
  open: boolean;
  onClose: () => void;
  /** El grupo ya no existe: la pantalla recarga la lista o vuelve al índice. */
  onDeleted: () => void;
}

/**
 * Confirmación de «Eliminar grupo» (Figma `admin-10`): el título nombra al grupo,
 * el texto dice qué se pierde (materias, asignaciones y código vigente) y el aviso
 * «Antes de continuar» marca lo irreversible. El botón destructivo lleva el nombre
 * del objeto, no solo un color.
 */
export function GroupDeleteDialog({ group, open, onClose, onDeleted }: GroupDeleteDialogProps) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const materias = subjectsCount(group);

  async function confirmar() {
    setBorrando(true);
    setError(null);
    try {
      await deleteGroup(group.id);
      setBorrando(false);
      onDeleted();
    } catch (err) {
      if (err instanceof NoStaffSession) {
        router.replace("/ingresar");
        return;
      }
      console.warn("[WEB-04] No se pudo eliminar el grupo:", err);
      setBorrando(false);
      setError(err instanceof Error ? err.message : "No pudimos eliminar el grupo.");
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
      title={`¿Eliminar ${group.label}?`}
      description={`Se eliminarán el grupo, sus ${materias} ${materias === 1 ? "materia" : "materias"} y sus asignaciones. Los estudiantes perderán el acceso con ${group.accessCode}.`}
      actions={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={borrando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={borrando}>
            {borrando ? "Eliminando…" : "Eliminar grupo"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Notice title="Antes de continuar">
          Las guías de este grupo dejarán de estar disponibles. Esta acción no se puede deshacer.
        </Notice>
        {error && (
          <Notice tone="error" title="No pudimos eliminar el grupo">
            {error}
          </Notice>
        )}
      </div>
    </Dialog>
  );
}
