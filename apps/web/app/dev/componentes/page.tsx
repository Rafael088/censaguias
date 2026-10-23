"use client";

import { BookOpen, FlaskConical, LogOut, Users } from "lucide-react";
import { useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Button } from "@/components/button";
import { DataTable, TableActions, TableCell, TableRow } from "@/components/data-table";
import { Dialog } from "@/components/dialog";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { FilterTabs, type TabOption } from "@/components/filter-tabs";
import { GroupHeader } from "@/components/group-header";
import { GuideCard } from "@/components/guide-card";
import { Notice } from "@/components/notice";
import { SearchInput } from "@/components/search-input";
import { Select } from "@/components/select";
import { Sidebar } from "@/components/sidebar";
import { StatusChip } from "@/components/status-chip";
import { SubjectCard } from "@/components/subject-card";

const colors = [
  { name: "Principal", hex: "#00843D", className: "bg-primary" },
  { name: "Texto", hex: "#064A2B", className: "text-ink" },
  { name: "Texto secundario", hex: "#397452", className: "text-muted" },
  { name: "Tinte", hex: "#E8F5ED", className: "bg-tint" },
  { name: "Superficie", hex: "#FFFFFF", className: "bg-surface" },
  { name: "Trazo", hex: "#C9E3D2", className: "bg-line" },
];

const filterOptions: TabOption[] = [
  { value: "todas", label: "Todas" },
  { value: "publicada", label: "Publicada" },
  { value: "borrador", label: "Borrador" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-section font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentesPage() {
  const [tab, setTab] = useState("todas");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 p-6 pb-24">
      <header className="flex flex-col gap-2">
        <h1 className="text-display font-semibold text-primary">Componentes base</h1>
        <p className="text-body text-muted">
          Sistema de diseño CENSA (<code className="text-label">apps/web/components/</code>). Cada componente copia los
          textos y estilos del Figma; ver <code className="text-label">docs/DISENO.md</code> y <code className="text-label">docs/diseno/</code>.
        </p>
      </header>

      <Section title="Color institucional">
        <div className="flex flex-wrap gap-4">
          {colors.map((color) => (
            <div key={color.name} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
              <span className={`h-10 w-10 rounded-control border border-line ${color.className}`} aria-hidden />
              <div>
                <p className="text-label font-semibold text-ink">{color.name}</p>
                <p className="text-meta text-muted">{color.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía · Inter">
        <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-6">
          <p className="text-display font-semibold text-ink">Display · 40</p>
          <p className="text-section font-semibold text-ink">Título de sección · 24 / 600</p>
          <p className="text-body text-ink">Cuerpo · 16 / 400 · interlineado 1,45</p>
          <p className="text-label font-semibold text-ink">Etiquetas · 14 / 600</p>
          <p className="text-meta text-muted">Metadatos · 13 / 400</p>
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-6">
          <Button>Guardar</Button>
          <Button variant="secondary">Cancelar</Button>
          <Button variant="text">Ver detalle</Button>
          <Button disabled>No disponible</Button>
          <Button size="sm">Ver</Button>
        </div>
      </Section>

      <Section title="Campos y selectores">
        <div className="grid gap-6 rounded-card border border-line bg-surface p-6 md:grid-cols-2">
          <Field label="Código de tu grupo" placeholder="CENSA-4AM-K7Q" hint="Incluye las letras, los números y los guiones." />
          <Field
            label="Código de grupo"
            defaultValue="CENSA-000"
            error="El código no es válido. Verifícalo con tu institución e inténtalo de nuevo."
          />
          <Select label="Jornada" defaultValue="manana">
            <option value="manana">Mañana</option>
            <option value="noche">Noche</option>
            <option value="sabatina">Sabatina</option>
          </Select>
          <SearchInput placeholder="Buscar por nombre o código" />
        </div>
      </Section>

      <Section title="Filtros y estados">
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
          <FilterTabs options={filterOptions} value={tab} onChange={setTab} label="Estado de la guía" />
          <div className="flex flex-wrap gap-2">
            <StatusChip status="published" />
            <StatusChip status="draft" />
          </div>
        </div>
      </Section>

      <Section title="Tarjetas">
        <div className="grid gap-4 md:grid-cols-2">
          <SubjectCard
            name="Matemáticas"
            description="Álgebra y operaciones"
            teacher="Laura Martínez"
            guideCount={2}
            href="#"
            icon={BookOpen}
          />
          <GuideCard
            topic="Álgebra"
            title="Ecuaciones de primer grado"
            description="Resolución paso a paso con ejercicios guiados."
            meta="PDF · 1,8 MB · 14 oct 2026"
            actions={
              <>
                <Button variant="text" size="sm">Abrir</Button>
                <Button variant="text" size="sm">Descargar</Button>
              </>
            }
          />
        </div>
      </Section>

      <Section title="Tabla con acciones de texto">
        <DataTable head={[{ label: "CLEI" }, { label: "Grupo" }, { label: "Jornada" }, { label: "Código único" }, { label: "Acciones" }]} caption="Grupos CLEI de ejemplo">
          <TableRow>
            <TableCell>CLEI IV</TableCell>
            <TableCell>A</TableCell>
            <TableCell>Mañana</TableCell>
            <TableCell className="font-semibold">CENSA-4AM-26</TableCell>
            <TableCell>
              <TableActions
                actions={[
                  { label: "Ver", onClick: () => {} },
                  { label: "Editar", onClick: () => {} },
                  { label: "Eliminar", onClick: () => {} },
                ]}
              />
            </TableCell>
          </TableRow>
        </DataTable>
      </Section>

      <Section title="Avisos">
        <div className="flex flex-col gap-4">
          <Notice title="Un código único para cada grupo">
            Comparte únicamente el código del grupo correspondiente. Regenerar un código invalida el anterior.
          </Notice>
          <Notice tone="success" title="Guía publicada correctamente">
            Ya pueden verla los estudiantes de la materia.
          </Notice>
          <Notice tone="error" title="No pudimos subir el archivo">
            El PDF supera el límite de 10 MB. Reduce el tamaño e inténtalo de nuevo.
          </Notice>
        </div>
      </Section>

      <Section title="Diálogo de confirmación">
        <Button variant="secondary" onClick={() => setDialogOpen(true)}>
          Eliminar CLEI IV · A
        </Button>
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="¿Eliminar CLEI IV · A?"
          description="Se eliminarán el grupo, sus materias y sus guías. Esta acción no se puede deshacer."
          actions={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setDialogOpen(false)}>Eliminar grupo</Button>
            </>
          }
        />
      </Section>

      <Section title="Estado vacío">
        <EmptyState
          title="Esta materia todavía no tiene guías"
          description="Cuando tu docente publique guías, aparecerán aquí."
        />
      </Section>

      <Section title="Cabecera de grupo">
        <GroupHeader name="CLEI IV · A" journey="Mañana" year={2026} code="CENSA-4AM-26" />
      </Section>

      <Section title="Barra lateral y navegación inferior">
        <div className="flex flex-col gap-4 md:flex-row">
          <div className="h-[560px] overflow-hidden rounded-card border border-line">
            <Sidebar
              space="Espacio estudiante"
              help="Acceso por código de grupo. No necesitas una cuenta."
              items={[
                { label: "Materias", href: "#", icon: BookOpen, active: true },
                { label: "Mi grupo", href: "#", icon: Users },
              ]}
              action={{ label: "Cambiar código", href: "#", icon: LogOut }}
            />
          </div>
          <div className="w-full max-w-[390px] rounded-card border border-line bg-tint p-4">
            <p className="mb-2 text-meta text-muted">Móvil · 390 px</p>
            <div className="relative h-40 rounded-control border border-line bg-surface">
              <BottomNav
                fixed={false}
                className="absolute inset-x-0 bottom-0"
                items={[
                  { label: "Materias", href: "#", icon: BookOpen, active: true },
                  { label: "Mi grupo", href: "#", icon: Users },
                ]}
              />
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}
