"use client";

/**
 * Sections an addon contributes to the Markdown export of selected files,
 * collected from whichever components know how to produce them.
 *
 * A module-level store rather than a context, as in `readingTabs`: the export
 * dialog and the offering components are mounted by different `AddonSlot`s,
 * from different addons, with no shared ancestor a provider could wrap.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { FileItem } from "@/types";

export type SectionResult =
  /** Body only; the export writes the heading. Its own headings start at `####`. */
  | { kind: "section"; markdown: string }
  /** The provider applies to this file and has nothing for it. */
  | { kind: "empty" }
  /** The provider never applies to this file, so its absence is not a gap. */
  | { kind: "not-applicable" };

export interface ExportSectionProvider {
  id: string;
  /** Already translated; becomes the section's `###` heading. */
  label: string;
  /** Ascending; ties fall back to `id` so mount order never reorders sections. */
  order: number;
  /** Written once under the document title when this provider produced a section. */
  preamble?: string;
  /** A rejection is a failure to load, not `empty`. */
  build(file: FileItem, drive: string, signal: AbortSignal): Promise<SectionResult>;
}

const EMPTY: readonly ExportSectionProvider[] = [];

/**
 * Keyed by provider id, then the offering component. The inner key keeps two
 * mounts of one provider from cancelling each other when one of them unmounts.
 */
const offers = new Map<string, Map<symbol, ExportSectionProvider>>();
const listeners = new Set<() => void>();
let snapshot: readonly ExportSectionProvider[] | null = null;

function publish(): void {
  // `useSyncExternalStore` compares snapshots by identity: rebuilt on change,
  // stable in between, or every read re-renders.
  snapshot = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function offer(by: symbol, provider: ExportSectionProvider): void {
  const held = offers.get(provider.id) ?? new Map<symbol, ExportSectionProvider>();
  held.set(by, provider);
  offers.set(provider.id, held);
  publish();
}

function withdraw(by: symbol, id: string): void {
  const held = offers.get(id);
  if (!held?.delete(by)) return;
  if (held.size === 0) offers.delete(id);
  publish();
}

function read(): readonly ExportSectionProvider[] {
  if (snapshot) return snapshot;
  const built: ExportSectionProvider[] = [];
  for (const held of offers.values()) {
    const first = held.values().next();
    if (!first.done) built.push(first.value);
  }
  built.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  snapshot = built.length > 0 ? built : EMPTY;
  return snapshot;
}

export function useExportSections(): readonly ExportSectionProvider[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

/**
 * Offer a provider for as long as the component is mounted. `provider` should
 * be memoised: a new object on every render withdraws and re-offers it.
 */
export function useOfferExportSection(provider: ExportSectionProvider | null): void {
  const registrantRef = useRef<symbol | null>(null);
  if (registrantRef.current === null) registrantRef.current = Symbol("export-section");
  const registrant = registrantRef.current;

  useEffect(() => {
    if (!provider) return;
    offer(registrant, provider);
    return () => withdraw(registrant, provider.id);
  }, [registrant, provider]);
}

/** Test seam: drop every offer. */
export function resetExportSections(): void {
  offers.clear();
  publish();
}
