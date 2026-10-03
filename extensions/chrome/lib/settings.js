import { normalizeOrigin, hostPattern, validateDrive, validateFolder } from "./destination.js";

const MODES = new Set(["manual", "missing_captions", "always"]);

export function createSettings(storage, permissions) {
  const ready = storage.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  let tail = ready;
  function serialize(action) {
    const result = tail.then(action);
    tail = result.catch(() => {});
    return result;
  }
  async function get() {
    await ready;
    const { settings } = await storage.get("settings");
    if (!settings?.origin) return { origin: null, sttMode: "manual", generation: "", lastDestination: null };
    return { origin: normalizeOrigin(settings.origin), sttMode: MODES.has(settings.sttMode) ? settings.sttMode : "manual", generation: settings.generation, lastDestination: settings.lastDestination ?? null };
  }
  return {
    get,
    save: (origin, sttMode) => serialize(async () => {
      origin = normalizeOrigin(origin);
      if (!MODES.has(sttMode)) throw new Error("invalidSettings");
      const pattern = hostPattern(origin);
      if (!await permissions.contains({ origins: [pattern] })) throw new Error("permissionRequired");
      const old = await get();
      const settings = { origin, sttMode, generation: crypto.randomUUID(), lastDestination: old.origin === origin ? old.lastDestination : null };
      await storage.set({ settings });
      if (old.origin && hostPattern(old.origin) !== pattern) await permissions.remove({ origins: [hostPattern(old.origin)] }).catch(() => {});
      return settings;
    }),
    remember: (expected, destination) => serialize(async () => {
      const current = await get();
      if (current.origin !== expected.origin || current.generation !== expected.generation) return;
      const lastDestination = { drive: validateDrive(destination.drive), folder: validateFolder(destination.folder) };
      await storage.set({ settings: { ...current, lastDestination } });
    }),
  };
}
