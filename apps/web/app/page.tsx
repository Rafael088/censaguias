import { AccessCodeForm } from "./access-code-form";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-3xl font-semibold">CensaGuias</h1>
        <p className="mt-2 text-muted">Escribe el código que te dio tu institución para ver las guías de tu grupo.</p>
      </div>
      <AccessCodeForm />
    </main>
  );
}
