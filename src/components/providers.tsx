"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { LocaleProvider } from "@/lib/i18n";
import type { AppLocale } from "@/lib/locale";

export function Providers({ children, locale }: { children: React.ReactNode; locale: AppLocale }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <LocaleProvider locale={locale}>
        {children}
        <Toaster position="bottom-right" />
      </LocaleProvider>
    </ThemeProvider>
  );
}
