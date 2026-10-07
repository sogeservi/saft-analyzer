"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AnalysisResult } from "@/lib/types/analysis";
import { useLocale } from "@/lib/i18n";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ShareDialogProps {
  result: AnalysisResult;
}

export function ShareDialog({ result }: ShareDialogProps) {
  const { t, languageTag } = useLocale();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!isRecord(data)) throw new Error(t("Resposta inválida do servidor."));
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? t(data.error) : t("Erro ao criar link"));
      }
      if (typeof data.url !== "string" || typeof data.expiresAt !== "number") throw new Error(t("Resposta inválida do servidor."));
      setShareUrl(`${window.location.origin}${data.url}`);
      setExpiresAt(new Date(data.expiresAt).toLocaleString(languageTag));
    } catch (error) {
      toast.error(error instanceof Error ? t(error.message) : t("Erro ao criar link de partilha"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t("Link copiado"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("Não foi possível copiar o link."));
    }
  };

  return (
    <Dialog onOpenChange={(open) => { if (!open) setShareUrl(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" /> {t("Partilhar")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Partilhar análise")}</DialogTitle>
          <DialogDescription>
            {t("O relatório inclui dados da empresa, clientes e documentos. Qualquer pessoa com o link poderá vê-los durante 24 horas.")}
          </DialogDescription>
        </DialogHeader>
        {!shareUrl ? (
          <div className="space-y-4">
            <Button onClick={handleShare} disabled={loading}>
              {loading ? t("A criar link…") : t("Criar link de 24 horas")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly aria-label={t("Link de partilha")} />
              <Button variant="outline" size="icon" onClick={handleCopy} aria-label={t("Copiar link")}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("Este link expira em")} {expiresAt}.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
