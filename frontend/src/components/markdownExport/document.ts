import { formatDuration } from "@/lib/format";

import type { ExportedFile, ExportResult, ProviderInfo, ProviderOutcome } from "./types";

export type Gap =
  | { kind: "missing"; providerId: string; label: string; titles: string[]; of: number }
  | { kind: "failed"; providerId: string; label: string; titles: string[] }
  | { kind: "unregistered"; id: string }
  | { kind: "noSections"; titles: string[] }
  | { kind: "notMedia"; count: number }
  | { kind: "overCap"; count: number };

function outcomeOf(file: ExportedFile, providerId: string): ProviderOutcome {
  const outcome = file.outcomes[providerId] ?? { kind: "failed" };
  return outcome.kind === "section" && !outcome.markdown.trim() ? { kind: "empty" } : outcome;
}

function hasSection(file: ExportedFile, providerIds: readonly string[]): boolean {
  return providerIds.some((id) => outcomeOf(file, id).kind === "section");
}

/** Everything the viewer is warned about before the document is shown. */
export function exportGaps(result: ExportResult): Gap[] {
  const gaps: Gap[] = [];
  const ids = result.providers.map((p) => p.id);

  for (const provider of result.providers) {
    const applicable = result.files.filter(
      (f) => outcomeOf(f, provider.id).kind !== "not-applicable",
    );
    const titlesOf = (kind: "empty" | "failed") =>
      applicable.filter((f) => outcomeOf(f, provider.id).kind === kind).map((f) => f.file.title);
    const missing = titlesOf("empty");
    if (missing.length > 0) {
      gaps.push({
        kind: "missing",
        providerId: provider.id,
        label: provider.label,
        titles: missing,
        of: applicable.length,
      });
    }
  }
  for (const provider of result.providers) {
    const failed = result.files
      .filter((f) => outcomeOf(f, provider.id).kind === "failed")
      .map((f) => f.file.title);
    if (failed.length > 0) {
      gaps.push({ kind: "failed", providerId: provider.id, label: provider.label, titles: failed });
    }
  }
  for (const id of result.unregistered) gaps.push({ kind: "unregistered", id });

  const bare = result.files.filter((f) => !hasSection(f, ids)).map((f) => f.file.title);
  if (bare.length > 0) gaps.push({ kind: "noSections", titles: bare });
  if (result.notMedia > 0) gaps.push({ kind: "notMedia", count: result.notMedia });
  if (result.overCap > 0) gaps.push({ kind: "overCap", count: result.overCap });
  return gaps;
}

export interface ExportLabels {
  title(videoCount: number): string;
  added: string;
}

function oneLine(text: string): string {
  return text
    .replace(/[\r\n\u2028\u2029\u0085\v\f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([[\]\\])/g, "\\$1");
}

/**
 * GitHub's heading anchor: what it keeps is letters, marks, digits, connector
 * punctuation (`_`) and hyphens, and each space becomes its own hyphen, so a
 * removed `|` between two spaces leaves two.
 */
function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/**
 * The link as the URL parser writes it, which has no line break in it, with
 * the brackets encoded so no text a provider treats as a tag can be spelled in
 * it; or nothing.
 */
function linkOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href.replace(/\[/g, "%5B").replace(/\]/g, "%5D");
  } catch {
    return null;
  }
}

function addedDay(createdAt: string): string | null {
  return createdAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function metadataLine(entry: ExportedFile, labels: Pick<ExportLabels, "added">): string | null {
  const { file } = entry;
  const parts: string[] = [];
  if (file.duration !== null && file.duration !== undefined) {
    parts.push(formatDuration(file.duration));
  }
  const day = addedDay(file.created_at);
  if (day) parts.push(`${labels.added} ${day}`);
  const tags = file.tags.map((tag) => tag.trim().replace(/\s+/g, "-")).filter(Boolean);
  if (tags.length > 0) parts.push(tags.map((tag) => `#${tag}`).join(" "));
  const link = entry.originalUrl ? linkOf(entry.originalUrl) : null;
  if (link) parts.push(link);
  return parts.length > 0 ? `_${parts.join(" · ")}_` : null;
}

export interface ExportDocument {
  /** The title, the providers' legends, the contents list and the rule under them. */
  head: string;
  /** One block per video that has a section, in order, `## heading` first. */
  videos: { heading: string; markdown: string }[];
}

function preamblesFor(providers: readonly ProviderInfo[], files: readonly ExportedFile[]): string[] {
  return providers
    .filter((p) => p.preamble && files.some((f) => outcomeOf(f, p.id).kind === "section"))
    .map((p) => p.preamble as string);
}

function videoBlock(
  entry: ExportedFile,
  providers: readonly ProviderInfo[],
  heading: string,
  labels: Pick<ExportLabels, "added">,
  preambles: readonly string[] = [],
): string {
  const blocks: string[] = [`## ${heading}`];
  const meta = metadataLine(entry, labels);
  if (meta) blocks.push(meta);
  blocks.push(...preambles);
  for (const provider of providers) {
    const outcome = outcomeOf(entry, provider.id);
    if (outcome.kind !== "section") continue;
    blocks.push(`### ${oneLine(provider.label)}`, outcome.markdown.trim());
  }
  return blocks.join("\n\n");
}

/**
 * One video as a document of its own: its block and the keys to its sections,
 * with no title, contents list or number. `null` when no provider gave it a
 * section.
 */
export function assembleVideoMarkdown(
  entry: ExportedFile,
  providers: readonly ProviderInfo[],
  labels: Pick<ExportLabels, "added">,
): string | null {
  if (!hasSection(entry, providers.map((p) => p.id))) return null;
  return videoBlock(entry, providers, oneLine(entry.file.title), labels, preamblesFor(providers, [entry]));
}

export function buildExportDocument(result: ExportResult, labels: ExportLabels): ExportDocument {
  const ids = result.providers.map((p) => p.id);
  const included = result.files.filter((f) => hasSection(f, ids));
  const preambles = preamblesFor(result.providers, included);

  const entries = included.map((file, i) => {
    const text = oneLine(file.file.title);
    return { file, number: i + 1, text, heading: `${i + 1}. ${text}` };
  });

  const head: string[] = [`# ${labels.title(entries.length)}`, ...preambles];
  if (entries.length > 0) {
    head.push(
      entries.map((e) => `${e.number}. [${e.text}](#${anchorOf(e.heading)})`).join("\n"),
      "---",
    );
  }

  const videos = entries.map(({ file: entry, heading }) => ({
    heading,
    markdown: videoBlock(entry, result.providers, heading, labels),
  }));

  return { head: head.join("\n\n"), videos };
}

export function exportDocumentMarkdown(doc: ExportDocument): string {
  return [doc.head, ...doc.videos.map((v) => v.markdown)].join("\n\n");
}

export function assembleExportMarkdown(result: ExportResult, labels: ExportLabels): string {
  return exportDocumentMarkdown(buildExportDocument(result, labels));
}
