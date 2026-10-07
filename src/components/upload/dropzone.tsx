"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({ onFiles, disabled }: DropzoneProps) {
  const { t } = useLocale();
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".xml"),
      );
      if (files.length > 0) onFiles(files);
    },
    [onFiles, disabled],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      if (files.length > 0) onFiles(files);
      e.target.value = "";
    },
    [onFiles],
  );

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors",
        dragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        disabled && "pointer-events-none opacity-50",
      )}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <Upload className="size-10 text-muted-foreground" />
      <div className="text-center">
        <p className="text-lg font-medium">{t("Arraste ficheiros SAF-T para aqui")}</p>
        <p className="text-sm text-muted-foreground">
          {t("ou clique para selecionar ficheiros .xml")}
        </p>
      </div>
      <input
        type="file"
        accept=".xml"
        multiple
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />
    </label>
  );
}
