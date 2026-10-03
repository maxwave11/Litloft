"use client";

/**
 * Tabs an addon adds to the row under a video or audio file, collected from
 * whichever components know of something to show, and the mark that tells
 * them whether anything draws that row.
 *
 * A module-level store rather than a context, as in `fileAiActions`: the
 * offering component and the row are mounted by different `AddonSlot`s, from
 * different addons, with no shared ancestor a provider could wrap.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface ReadingTab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Ascending; ties fall back to `id` so mount order never reorders the row. */
  order: number;
  panel: ReactNode;
}

const EMPTY: readonly ReadingTab[] = [];

/**
 * Keyed by file, then tab id, then the offering component. The inner key
 * keeps two mounts of one offer (inspector and bottom sheet) from cancelling
 * each other when one of them unmounts.
 */
const offers = new Map<string, Map<string, Map<symbol, ReadingTab>>>();
const hosts = new Map<string, Set<symbol>>();
const listeners = new Set<() => void>();
let snapshots = new Map<string, readonly ReadingTab[]>();

function publish(): void {
  // `useSyncExternalStore` compares snapshots by identity: rebuilt on change,
  // stable in between, or every read re-renders.
  snapshots = new Map();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function offer(by: symbol, fileId: string, tab: ReadingTab): void {
  const byId = offers.get(fileId) ?? new Map<string, Map<symbol, ReadingTab>>();
  const held = byId.get(tab.id) ?? new Map<symbol, ReadingTab>();
  held.set(by, tab);
  byId.set(tab.id, held);
  offers.set(fileId, byId);
  publish();
}

function withdraw(by: symbol, fileId: string, id: string): void {
  const byId = offers.get(fileId);
  const held = byId?.get(id);
  if (!byId || !held?.delete(by)) return;
  if (held.size === 0) byId.delete(id);
  if (byId.size === 0) offers.delete(fileId);
  publish();
}

function read(fileId: string): readonly ReadingTab[] {
  const cached = snapshots.get(fileId);
  if (cached) return cached;
  const built: ReadingTab[] = [];
  for (const held of offers.get(fileId)?.values() ?? []) {
    const first = held.values().next();
    if (!first.done) built.push(first.value);
  }
  built.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const result = built.length > 0 ? built : EMPTY;
  snapshots.set(fileId, result);
  return result;
}

export function useReadingTabs(fileId: string): readonly ReadingTab[] {
  const getSnapshot = useCallback(() => read(fileId), [fileId]);
  const getServerSnapshot = useCallback(() => EMPTY, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Offer a tab for as long as `tab` is not null. The panel is drawn by the
 * host, so it should be an element the offerer built, not a component that
 * reads the offerer's state.
 *
 * Call it above the component's early returns: a component with nothing to
 * show yet is usually the one with something to offer.
 */
export function useOfferReadingTab(fileId: string, tab: ReadingTab | null): void {
  const registrantRef = useRef<symbol | null>(null);
  if (registrantRef.current === null) registrantRef.current = Symbol("reading-tab");
  const registrant = registrantRef.current;

  useEffect(() => {
    if (!tab) return;
    offer(registrant, fileId, tab);
    return () => withdraw(registrant, fileId, tab.id);
  }, [registrant, fileId, tab]);
}

/** Mark that this component draws the file's tab row, for as long as it is mounted. */
export function useReadingTabHost(fileId: string): void {
  const registrantRef = useRef<symbol | null>(null);
  if (registrantRef.current === null) registrantRef.current = Symbol("reading-tab-host");
  const registrant = registrantRef.current;

  useEffect(() => {
    const held = hosts.get(fileId) ?? new Set<symbol>();
    held.add(registrant);
    hosts.set(fileId, held);
    publish();
    return () => {
      held.delete(registrant);
      if (held.size === 0) hosts.delete(fileId);
      publish();
    };
  }, [registrant, fileId]);
}

export function useHasReadingTabHost(fileId: string): boolean {
  const getSnapshot = useCallback(() => (hosts.get(fileId)?.size ?? 0) > 0, [fileId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Test seam: drop every offer and host. */
export function resetReadingTabs(): void {
  offers.clear();
  hosts.clear();
  publish();
}
