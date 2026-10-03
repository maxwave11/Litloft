"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

export function createFileMetadataStore<T>(load: (drive: string, ids: string[]) => Promise<Record<string, T>>) {
  const cache = new Map<string, T>();
  const subscribers = new Map<string, Set<() => void>>();
  const identities = new Map<string, { drive: string; id: string }>();
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  let running = false;

  function schedule() {
    if (!timer && !running) timer = setTimeout(() => void flush(), 40);
  }
  async function flush() {
    timer = undefined;
    running = true;
    const grouped = new Map<string, string[]>();
    for (const key of pending) {
      const identity = identities.get(key);
      if (identity && subscribers.has(key)) {
        const ids = grouped.get(identity.drive) ?? [];
        ids.push(identity.id);
        grouped.set(identity.drive, ids);
      }
    }
    pending.clear();
    try {
      await Promise.all([...grouped].map(async ([drive, ids]) => {
        for (let offset = 0; offset < ids.length; offset += 100) {
          const batch = ids.slice(offset, offset + 100);
          try {
            const data = await load(drive, batch);
            for (const id of batch) {
              const key = JSON.stringify([drive, id]);
              if (!subscribers.has(key)) continue;
              if (data[id] === undefined) cache.delete(key);
              else cache.set(key, data[id]);
              subscribers.get(key)?.forEach(listener => listener());
            }
          } catch {
            // Keep the last known snapshot through a temporary service outage.
          }
        }
      }));
    } finally {
      running = false;
      if (pending.size) schedule();
    }
  }
  function refresh() {
    subscribers.forEach((_, key) => pending.add(key));
    schedule();
  }
  function subscribe(key: string, drive: string, id: string, listener: () => void) {
    const listeners = subscribers.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    subscribers.set(key, listeners);
    identities.set(key, { drive, id });
    pending.add(key);
    schedule();
    if (!poll) {
      poll = setInterval(refresh, 10000);
      window.addEventListener("focus", refresh);
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        subscribers.delete(key);
        identities.delete(key);
        cache.delete(key);
        pending.delete(key);
      }
      if (!subscribers.size) {
        clearInterval(poll);
        clearTimeout(timer);
        poll = undefined;
        timer = undefined;
        window.removeEventListener("focus", refresh);
      }
    };
  }
  return function useFileMetadata(fileId: string, drive: string) {
    const key = JSON.stringify([drive, fileId]);
    const listen = useCallback((listener: () => void) => subscribe(key, drive, fileId, listener), [key, drive, fileId]);
    const snapshot = useCallback(() => cache.get(key), [key]);
    const event = useWebSocket();
    useEffect(() => {
      if (event && /updated|completed|failed|queued|started|summary|transcript/.test(event.event)) {
        pending.add(key);
        schedule();
      }
    }, [event, key]);
    return useSyncExternalStore(listen, snapshot, () => undefined);
  };
}
