import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Github } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SAF-T Analyzer",
  description: "Análise e validação de ficheiros SAF-T portugueses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <footer className="border-t bg-background px-4 py-4 text-sm text-muted-foreground">
              <div className="mx-auto flex max-w-screen-2xl justify-center">
                <a
                  href="https://github.com/sogeservi/saft-analyzer"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Repositório do SAF-T Analyzer no GitHub (abre num novo separador)"
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
