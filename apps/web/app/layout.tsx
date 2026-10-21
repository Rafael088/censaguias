import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CensaGuias",
  description: "Las guías de tus asignaturas, en un solo lugar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}
