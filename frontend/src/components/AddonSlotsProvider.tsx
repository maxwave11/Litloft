"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AddonsStatus, SlotEntry } from "@/lib/addons";
import { getAddonsStatus } from "@/lib/addons";
import { useCurrentDrive } from "@/components/CurrentDriveProvider";

// Values follow the backend
// convention: literal `false` or string "false" mean fully off; any other
// value (true, "manual", "on_index", etc.) counts as enabled.
export type AddonFeatureValue = boolean | string;

export interface AddonStatus {
  features: Record<string, AddonFeatureValue>;
}

interface AddonSlotsContextValue {
  addons: AddonsStatus["addons"];
  /**
   * The drive the loaded catalogue was fetched for. It lags the current
   * drive between a switch and the new response, so a consumer that must not
   * show one drive's addons on another compares the two.
   */
  catalogueDrive: string | null | undefined;
  slots: Record<string, SlotEntry[]>;
  loading: boolean;
  /**
   * True until every active addon's slot module has been loaded or has
   * failed to. A module can register something at import time, such as a
   * `.loft` player, so a consumer that would otherwise fall back must wait
   * for this first. False without a provider: there is nothing to wait for.
   */
  modulesPending: boolean;
  getSlotEntries: (slotId: string) => SlotEntry[];
  hasSlot: (slotId: string) => boolean;
}

// Mirror of the regex used by the dynamic-import call sites; keeps the
// preloader aligned with what's a legal addon directory name.
const VALID_ADDON_NAME_FOR_PRELOAD = /^[a-z][a-z0-9_-]*$/;

const AddonSlotsContext = createContext<AddonSlotsContextValue>({
  addons: {},
  catalogueDrive: undefined,
  slots: {},
  loading: true,
  modulesPending: false,
  getSlotEntries: () => [],
  hasSlot: () => false,
});

export function AddonSlotsProvider({ children }: { children: ReactNode }) {
  const [addons, setAddons] = useState<AddonsStatus["addons"]>({});
  const [slots, setSlots] = useState<Record<string, SlotEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [modulesPending, setModulesPending] = useState(true);
  const [catalogueDrive, setCatalogueDrive] = useState<string | null | undefined>(undefined);
  const drive = useCurrentDrive();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setModulesPending(true);
    getAddonsStatus(drive).then((status) => {
      if (cancelled) return;
      setAddons(status.addons);
      setSlots(status.slots);
      setCatalogueDrive(drive);
      setLoading(false);
      // Eagerly preload each active addon's slot module. Some addons
      // (e.g. media_import) rely on side-effect imports inside slots.ts
      // to register .loft players; `modulesPending` tells LoftPlayer to wait
      // for them rather than draw its fallback.
      const loads = Object.keys(status.addons)
        .filter((name) => VALID_ADDON_NAME_FOR_PRELOAD.test(name))
        .map((name) => import(`@/addons/${name}/slots.ts`));
      void Promise.allSettled(loads).then(() => {
        if (!cancelled) setModulesPending(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [drive]);

  const getSlotEntries = (slotId: string): SlotEntry[] => slots[slotId] ?? [];
  const hasSlot = (slotId: string): boolean => {
    const entries = slots[slotId];
    return !!entries && entries.length > 0;
  };

  return (
    <AddonSlotsContext.Provider
      value={{
        addons,
        catalogueDrive,
        slots,
        loading,
        modulesPending,
        getSlotEntries,
        hasSlot,
      }}
    >
      {children}
    </AddonSlotsContext.Provider>
  );
}

export function useAddonSlots() {
  return useContext(AddonSlotsContext);
}

const DEFAULT_STATUS: AddonStatus = { features: {} };

const _statusCache: Map<string, AddonStatus> = new Map();
const _statusPromise: Map<string, Promise<AddonStatus>> = new Map();

function statusKey(addonName: string, drive: string | null): string {
  return `${addonName}|${drive ?? ""}`;
}

async function fetchAddonStatus(
  addonName: string,
  drive: string,
  signal: AbortSignal,
): Promise<AddonStatus> {
  const res = await fetch(`/api/addons/${encodeURIComponent(addonName)}/status`, {
    credentials: "include",
    headers: { "X-Lit-Drive": encodeURIComponent(drive) },
    signal,
  });
  if (!res.ok) return DEFAULT_STATUS;
  const data = (await res.json()) as { features?: Record<string, AddonFeatureValue> } | null;
  return { features: data?.features ?? {} };
}

export function useAddonStatus(addonName: string): AddonStatus {
  const drive = useCurrentDrive();
  const key = statusKey(addonName, drive);
  const [status, setStatus] = useState<AddonStatus>(
    () => _statusCache.get(key) ?? DEFAULT_STATUS,
  );

  useEffect(() => {
    if (!drive) {
      setStatus(DEFAULT_STATUS);
      return;
    }
    const cached = _statusCache.get(key);
    if (cached) {
      setStatus(cached);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    let pending = _statusPromise.get(key);
    if (!pending) {
      pending = fetchAddonStatus(addonName, drive, controller.signal)
        .then((result) => {
          _statusCache.set(key, result);
          _statusPromise.delete(key);
          return result;
        })
        .catch(() => {
          _statusPromise.delete(key);
          return DEFAULT_STATUS;
        });
      _statusPromise.set(key, pending);
    }
    pending.then((result) => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [addonName, drive, key]);

  return status;
}
