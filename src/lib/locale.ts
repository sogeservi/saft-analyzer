export type AppLocale = "en" | "pt";

export function resolveLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return "en";

  const preferred = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, quality = "q=1"] = entry.trim().split(";");
      const parsedQuality = quality.startsWith("q=") ? Number(quality.slice(2)) : 1;
      return { tag: tag.toLowerCase(), quality: Number.isFinite(parsedQuality) ? parsedQuality : 0 };
    })
    .filter(({ quality }) => quality > 0)
    .sort((a, b) => b.quality - a.quality)[0]?.tag;

  return preferred === "pt" || preferred?.startsWith("pt-") ? "pt" : "en";
}
