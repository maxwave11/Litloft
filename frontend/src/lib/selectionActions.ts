"use client";

/**
 * Actions an addon offers to the selection bar.
 *
 * A module-level store rather than a context: the bar and the offering
 * entries are mounted by different `AddonSlot`s, from different addons, with
 * no shared ancestor a provider could wrap.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

export interface SelectionAction {
  /** Unique across addons; prefix it with the addon. */
  id: string;
  /** Already translated. The overflow menu row and the button's aria-label. */
  label: string;
  /** Shorter text for the bar; falls back to `label`. */
  displayLabel?: string;
  icon: LucideIcon;
  /** Ascending; ties fall back to `id` so mount order never reorders the bar. */
  order: number;
  disabled?: boolean;
  run: () => void;
}

const EMPTY: readonly SelectionAction[] = [];

/**
 * Keyed by offer id, then by the offering component, so two mounts of one
 * offer do not cancel each other when one of them unmounts.
 */
const registry = new Map<string, Map<symbol, SelectionAction>>();
const listeners = new Set<() => void>();
let snapshot: readonly SelectionAction[] | null = null;

function publish(): void {
  // `useSyncExternalStore` compares snapshots by identity: rebuilt on change,
  // stable in between, or every read re-renders.
  snapshot = null;
  for (const listener of listeners) listener();
}

function offer(by: symbol, action: SelectionAction): void {
  const held = registry.get(action.id) ?? new Map<symbol, SelectionAction>();
  held.set(by, action);
  registry.set(action.id, held);
  publish();
}

function withdraw(by: symbol, id: string): void {
  const held = registry.get(id);
  if (!held?.delete(by)) return;
  if (held.size === 0) registry.delete(id);
  publish();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(): readonly SelectionAction[] {
  if (snapshot) return snapshot;
  const built: SelectionAction[] = [];
  for (const held of registry.values()) {
    const first = held.values().next();
    if (!first.done) built.push(first.value);
  }
  built.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  snapshot = built.length > 0 ? built : EMPTY;
  return snapshot;
}

export function useSelectionActions(): readonly SelectionAction[] {
  const getServerSnapshot = useCallback(() => EMPTY, []);
  return useSyncExternalStore(subscribe, read, getServerSnapshot);
}

/**
 * Offer an action to the selection bar while `action` is not `null`.
 *
 * `run` is read through a ref, so a fresh closure each render does not
 * republish the offer.
 */
export function useOfferSelectionAction(action: SelectionAction | null): void {
  const runRef = useRef(action?.run);
  useEffect(() => {
    runRef.current = action?.run;
  });

  const registrantRef = useRef<symbol | null>(null);
  if (registrantRef.current === null) registrantRef.current = Symbol("selection-action");
  const registrant = registrantRef.current;

  const id = action?.id;
  const label = action?.label;
  const displayLabel = action?.displayLabel;
  const icon = action?.icon;
  const order = action?.order;
  const disabled = action?.disabled;

  useEffect(() => {
    if (
      id === undefined ||
      label === undefined ||
      icon === undefined ||
      order === undefined
    ) {
      return;
    }
    offer(registrant, {
      id,
      label,
      displayLabel,
      icon,
      order,
      disabled,
      run: () => runRef.current?.(),
    });
    return () => withdraw(registrant, id);
  }, [registrant, id, label, displayLabel, icon, order, disabled]);
}

/** Test seam: drop every offer. */
export function resetSelectionActions(): void {
  registry.clear();
  publish();
}
