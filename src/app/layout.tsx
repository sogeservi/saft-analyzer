import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { resolveLocale } from "@/lib/locale";
import { headers } from "next/headers";
import { Building2, Github } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale((await headers()).get("accept-language"));
  return {
    title: "SAF-T Analyzer",
    description:
      locale === "pt"
        ? "Análise e validação de ficheiros SAF-T portugueses"
        : "Analyze and validate Portuguese SAF-T files",
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveLocale((await headers()).get("accept-language"));
  return (
    <html lang={locale === "pt" ? "pt-PT" : "en"} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers locale={locale}>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <footer className="border-t bg-background px-4 py-4 text-sm text-muted-foreground">
              <div className="mx-auto flex max-w-screen-2xl flex-wrap justify-center gap-x-6 gap-y-3">
                <a
                  href="https://sogeservi.pt"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={locale === "pt" ? "Site da SogeServi (abre num novo separador)" : "SogeServi website (opens in a new tab)"}
                  className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Building2 className="size-4" aria-hidden="true" />
                  <span>Made by SogeServi</span>
                </a>
                <a
                  href="https://github.com/sogeservi/saft-analyzer"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={locale === "pt" ? "Repositório do SAF-T Analyzer no GitHub (abre num novo separador)" : "SAF-T Analyzer GitHub repository (opens in a new tab)"}
                  className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Github className="size-4" aria-hidden="true" />
                  <span>GitHub</span>
                </a>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
