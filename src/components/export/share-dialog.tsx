"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
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

interface ShareDialogProps {
  result: AnalysisResult;
}

export function ShareDialog({ result }: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      if (!response.ok) throw new Error("Erro ao criar link");

      const data = await response.json();
      const fullUrl = `${window.location.origin}${data.url}`;
      setShareUrl(fullUrl);
      setExpiresAt(new Date(data.expiresAt).toLocaleString("pt-PT"));
    } catch {
      toast.error("Erro ao criar link de partilha");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="size-4" />
          Partilhar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Partilhar análise</DialogTitle>
          <DialogDescription>
            Crie um link temporário para partilhar os resultados com outros
            utilizadores na intranet.
          </DialogDescription>
        </DialogHeader>
        {!shareUrl ? (
          <Button onClick={handleShare} disabled={loading}>
            {loading ? "A criar link…" : "Criar link de partilha"}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Este link expira em {expiresAt}.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
