"use client";

import { useEffect, useState } from "react";

import { useAddonSlots } from "@/components/AddonSlotsProvider";
import { useExportSections, type ExportSectionProvider } from "@/lib/exportSections";

export const EXPORT_SECTIONS_SLOT = "markdown-export-sections";
const WAIT_FOR_PROVIDERS_MS = 5000;

export interface ExportProviders {
  /** Whether the set below is final. */
  ready: boolean;
  providers: readonly ExportSectionProvider[];
  /** Labels of slot entries that had not offered a provider when it became ready. */
  unavailable: readonly string[];
}

/**
 * The providers the `markdown-export-sections` slot offers. Its entries load
 * lazily, so the set is final once every entry the slot lists has offered one,
 * or after a wait that stops a viewer looking at a spinner. The slot itself is
 * mounted by the caller.
 */
export function useExportProviders(): ExportProviders {
  const { getSlotEntries, loading: slotsLoading } = useAddonSlots();
  const offered = useExportSections();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), WAIT_FOR_PROVIDERS_MS);
    return () => clearTimeout(timer);
  }, []);

  const offeredIds = new Set(offered.map((p) => p.id));
  const notOffered = getSlotEntries(EXPORT_SECTIONS_SLOT).filter((e) => !offeredIds.has(e.id));
  return {
    ready: timedOut || (!slotsLoading && notOffered.length === 0),
    providers: offered,
    unavailable: notOffered.map((e) => e.label),
  };
}
