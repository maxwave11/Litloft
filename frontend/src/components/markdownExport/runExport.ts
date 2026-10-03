import { getStreamUrl } from "@/lib/api";
import type { ExportSectionProvider } from "@/lib/exportSections";
import type { FileItem } from "@/types";

import type { ExportedFile, ExportResult, ProviderOutcome } from "./types";

export const MAX_EXPORT_FILES = 200;
const FILES_IN_FLIGHT = 4;

export interface RunExportOptions {
  /** The selection, in list order. */
  files: readonly FileItem[];
  drive: string;
  providers: readonly ExportSectionProvider[];
  unregistered?: readonly string[];
  signal: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

async function readOriginalUrl(file: FileItem, signal: AbortSignal): Promise<string | null> {
  if (!file.filename.toLowerCase().endsWith(".loft")) return null;
  try {
    const res = await fetch(getStreamUrl(file.id), { credentials: "include", signal });
    if (!res.ok) return null;
    const content = (await res.json()) as { url?: unknown };
    return typeof content.url === "string" && content.url ? content.url : null;
  } catch {
    return null;
  }
}

async function runProvider(
  provider: ExportSectionProvider,
  file: FileItem,
  drive: string,
  signal: AbortSignal,
): Promise<ProviderOutcome> {
  try {
    return await provider.build(file, drive, signal);
  } catch {
    return { kind: "failed" };
  }
}

async function exportFile(
  file: FileItem,
  drive: string,
  providers: readonly ExportSectionProvider[],
  signal: AbortSignal,
): Promise<ExportedFile> {
  const [originalUrl, ...outcomes] = await Promise.all([
    readOriginalUrl(file, signal),
    ...providers.map((provider) => runProvider(provider, file, drive, signal)),
  ]);
  return {
    file,
    originalUrl,
    outcomes: Object.fromEntries(providers.map((p, i) => [p.id, outcomes[i]])),
  };
}

/** Resolves to `null` when `signal` aborts first. */
export async function runExport({
  files,
  drive,
  providers,
  unregistered = [],
  signal,
  onProgress,
}: RunExportOptions): Promise<ExportResult | null> {
  const media = files.filter((f) => f.file_type === "video" || f.file_type === "audio");
  const batch = media.slice(0, MAX_EXPORT_FILES);

  const exported: ExportedFile[] = new Array(batch.length);
  let next = 0;
  let done = 0;
  onProgress?.(0, batch.length);

  async function worker(): Promise<void> {
    while (!signal.aborted && next < batch.length) {
      const index = next++;
      exported[index] = await exportFile(batch[index], drive, providers, signal);
      done += 1;
      if (!signal.aborted) onProgress?.(done, batch.length);
    }
  }
  await Promise.all(Array.from({ length: FILES_IN_FLIGHT }, worker));
  if (signal.aborted) return null;

  return {
    files: exported,
    providers: providers.map(({ id, label, preamble }) => ({ id, label, preamble })),
    unregistered,
    notMedia: files.length - media.length,
    overCap: media.length - batch.length,
  };
}
