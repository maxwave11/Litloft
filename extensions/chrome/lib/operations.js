function sameContext(a, b) {
  return a.origin === b.origin && a.tabId === b.tabId && a.videoId === b.videoId;
}

export function createOperations(storage) {
  let records = [];
  let tail = (async () => {
    const saved = (await storage.get("operations")).operations ?? [];
    records = saved.map((record) => record.state === "pending" ? { ...record, state: "unknown" } : record);
    if (saved.some((record) => record.state === "pending")) await storage.set({ operations: records });
  })();
  function serialize(action) {
    const result = tail.then(action);
    tail = result.catch(() => {});
    return result;
  }
  const latest = (context) => records.findLast((record) => sameContext(record, context)) ?? null;
  return {
    find: (context) => serialize(() => structuredClone(latest(context))),
    reserve: (context, repeatId) => serialize(async () => {
      const existing = latest(context);
      if (existing && (existing.state === "pending" || repeatId !== existing.id)) return { operation: structuredClone(existing), created: false };
      const operation = { ...context, id: crypto.randomUUID(), state: "pending", createdAt: Date.now() };
      const terminal = records.filter((record) => record.state === "success" || record.state === "error").slice(-99);
      const next = [...records.filter((record) => record.state === "pending" || record.state === "unknown"), ...terminal, operation].sort((a, b) => a.createdAt - b.createdAt);
      await storage.set({ operations: next });
      records = next;
      return { operation: structuredClone(operation), created: true };
    }),
    finish: (id, result) => serialize(async () => {
      const record = records.find((item) => item.id === id);
      if (!record) throw new Error("requestFailed");
      const updated = { ...record, ...result };
      const next = records.map((item) => item.id === id ? updated : item);
      await storage.set({ operations: next });
      records = next;
      return structuredClone(updated);
    }),
  };
}
