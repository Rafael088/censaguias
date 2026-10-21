import { AccessCodeForm } from "./access-code-form";

// Provisional: la pantalla final (escritorio y móvil) es la tarea WEB-02. Ver docs/diseno/acceso-*.png

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-[32px] font-semibold">Tu grupo, tus guías.</h1>
        <p className="mt-2">Ingresa el código que te entregó tu institución para consultar tus materias.</p>
      </div>
      <AccessCodeForm />
    </main>
  );
}
