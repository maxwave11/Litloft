import { MAX_EXPORT_FILES } from "./runExport";
import type { Gap } from "./document";
import type { ExportResult } from "./types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

const TITLES_SHOWN = 5;

function titlesText(titles: readonly string[], t: Translate): string {
  const shown = titles.slice(0, TITLES_SHOWN).join(", ");
  const rest = titles.length - TITLES_SHOWN;
  return rest > 0 ? `${shown} ${t("andMore", { count: rest })}` : shown;
}

/** One sentence per gap, for the warning shown before the document. */
export function gapLines(gaps: readonly Gap[], result: ExportResult, t: Translate): string[] {
  const lines: string[] = [];
  if (result.providers.length === 0 && result.unregistered.length === 0) {
    lines.push(t("gapNoProviders"));
  }
  for (const gap of gaps) {
    switch (gap.kind) {
      case "missing":
        lines.push(
          t("gapMissing", {
            label: gap.label,
            count: gap.titles.length,
            total: gap.of,
            titles: titlesText(gap.titles, t),
          }),
        );
        break;
      case "failed":
        lines.push(t("gapFailed", { label: gap.label, titles: titlesText(gap.titles, t) }));
        break;
      case "unregistered":
        lines.push(t("gapUnavailable", { name: gap.id }));
        break;
      case "noSections":
        lines.push(t("gapNoSections", { titles: titlesText(gap.titles, t) }));
        break;
      case "notMedia":
        lines.push(t("gapNotMedia", { count: gap.count }));
        break;
      case "overCap":
        lines.push(t("gapOverCap", { max: MAX_EXPORT_FILES, count: gap.count }));
        break;
    }
  }
  return lines;
}
