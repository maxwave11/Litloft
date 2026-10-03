import type { SectionResult } from "@/lib/exportSections";
import type { FileItem } from "@/types";

/** What one provider answered for one file; `failed` is a rejected `build`. */
export type ProviderOutcome = SectionResult | { kind: "failed" };

export interface ExportedFile {
  file: FileItem;
  /** The link to the original video, for a `.loft` that has one. */
  originalUrl: string | null;
  /** By provider id. */
  outcomes: Record<string, ProviderOutcome>;
}

export interface ProviderInfo {
  id: string;
  label: string;
  preamble?: string;
}

export interface ExportResult {
  /** Video and audio files, in list order, already capped. */
  files: ExportedFile[];
  /** In provider order. */
  providers: readonly ProviderInfo[];
  /** Slot entries that had not registered when building started. */
  unregistered: readonly string[];
  notMedia: number;
  overCap: number;
}
