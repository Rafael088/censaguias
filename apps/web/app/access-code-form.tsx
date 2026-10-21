"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function AccessCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await api.v1.access.$post({ json: { code } });
    setPending(false);
    if (!res.ok) return setError("El código no es válido. Verifícalo con tu institución e inténtalo de nuevo.");
    router.push("/grupo");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="code" className="text-label font-semibold">Código de tu grupo</label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="CENSA-4AM-K7Q"
        aria-describedby="code-hint"
        autoComplete="off"
        autoCapitalize="characters"
        className="min-h-[46px] rounded-control border border-line px-3 uppercase focus:border-2 focus:border-primary"
      />
      <p id="code-hint" className="text-meta">Incluye las letras, los números y los guiones.</p>
      {error && <p role="alert" className="rounded-card bg-tint p-3 text-label">{error}</p>}
      <button disabled={pending} className="min-h-[46px] rounded-control bg-primary px-4 font-semibold text-white disabled:bg-tint disabled:text-primary">
        {pending ? "Ingresando…" : error ? "Intentar de nuevo" : "Ingresar a mi grupo"}
      </button>
    </form>
  );
}
