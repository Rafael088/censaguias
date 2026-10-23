"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Field } from "@/components/field";
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
      <Field
        label="Código de tu grupo"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="CENSA-4AM-K7Q"
        hint="Incluye las letras, los números y los guiones."
        error={error}
        autoComplete="off"
        autoCapitalize="characters"
        className="uppercase"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Ingresando…" : error ? "Intentar de nuevo" : "Ingresar a mi grupo"}
      </Button>
    </form>
  );
}
