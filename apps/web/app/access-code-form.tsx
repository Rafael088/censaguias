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
    if (!res.ok) return setError("Ese código no existe o ya no está activo.");
    router.push("/grupo");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="code" className="text-sm font-medium">Código de acceso</label>
      <input
        id="code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="ABCD-EFGH"
        autoComplete="off"
        autoCapitalize="characters"
        className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-lg tracking-widest uppercase"
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={pending} className="rounded-lg bg-brand px-4 py-2 font-medium text-white disabled:opacity-60">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
