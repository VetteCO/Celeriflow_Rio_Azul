import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SessionProvider } from "@/components/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Celeriflow — Gestão municipal", template: "%s | Celeriflow" },
  description: "Gestão de documentos, processos e atendimento municipal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessionProvider><AppShell>{children}</AppShell></SessionProvider>
      </body>
    </html>
  );
}
