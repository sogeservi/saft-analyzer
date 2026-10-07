"use client";

import { Github } from "lucide-react";
import Image from "next/image";
import { useLocale } from "@/lib/i18n";

export function AppFooter() {
  const { locale } = useLocale();
  const portuguese = locale === "pt";

  return (
    <footer className="border-t bg-background px-4 py-4 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap justify-center gap-x-6 gap-y-3">
        <a
          href="https://sogeservi.pt"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={portuguese
            ? "Site da Sogeservi (abre num novo separador)"
            : "Sogeservi website (opens in a new tab)"}
          className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span aria-hidden="true" className="size-4 shrink-0 overflow-hidden">
            <Image
              src="/sogeservi-logo-horizontal.png"
              alt=""
              width={248}
              height={79}
              unoptimized
              className="h-4 w-auto max-w-none"
            />
          </span>
          <span>{portuguese ? "Feito pela Sogeservi" : "Made by Sogeservi"}</span>
        </a>
        <a
          href="https://github.com/sogeservi/saft-analyzer"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={portuguese
            ? "Repositório do SAF-T Analyzer no GitHub (abre num novo separador)"
            : "SAF-T Analyzer GitHub repository (opens in a new tab)"}
          className="inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Github className="size-4" aria-hidden="true" />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  );
}
