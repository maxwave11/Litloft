import { createApi, ApiError } from "./api.js";
import { getVideo } from "./video.js";
import { hostPattern, validateDrive, validateFolder, folderUrl, fileUrl } from "./destination.js";

const TYPES = new Set(["getSettings", "saveSettings", "checkConnection", "openSettings", "bootstrap", "drive", "children", "import", "status"]);

export function createCommands({ chromeApi, settings, operations, apiFactory = createApi }) {
  function authorize(sender, type) {
    if (sender.id !== chromeApi.runtime.id || !TYPES.has(type)) throw new Error("notAllowed");
    const options = sender.url === chromeApi.runtime.getURL("options.html");
    const popup = sender.url === chromeApi.runtime.getURL("popup.html");
    const content = sender.frameId === 0 && sender.tab && Boolean(getVideo(sender.url));
    if (!options && !popup && !content) throw new Error("notAllowed");
    if (["getSettings", "saveSettings", "checkConnection"].includes(type) && !options) throw new Error("notAllowed");
    return { options, popup, content };
  }
  async function context(request, sender, caller, config) {
    const tabId = caller.content ? sender.tab.id : request.tabId;
    if (!Number.isInteger(tabId) || (caller.content && request.tabId !== undefined && request.tabId !== tabId)) throw new Error("notAllowed");
    const tab = await chromeApi.tabs.get(tabId);
    if (caller.popup && !tab.active) throw new Error("staleVideo");
    const video = getVideo(tab.url);
    if (!video || video.id !== request.videoId) throw new Error("staleVideo");
    if (request.generation !== undefined && request.generation !== config.generation) throw new Error("settingsChanged");
    return { origin: config.origin, generation: config.generation, tabId, videoId: video.id, video };
  }
  function presentOperation(record) {
    if (!record) return null;
    return {
      id: record.id, state: record.state, error: record.error,
      drive: record.drive, folder: record.folder, filename: record.filename,
      folderUrl: folderUrl(record.origin, record.drive, record.folder),
      fileUrl: record.fileId ? fileUrl(record.origin, record.drive, record.folder, record.fileId) : null,
    };
  }
  async function checkDrive(api, drive) {
    validateDrive(drive);
    if (!(await api.drives()).some((entry) => entry.name === drive)) throw new Error("unavailable");
    if (!await api.availability(drive)) throw new Error("importUnavailable");
  }
  async function checkFolder(api, drive, folder) {
    validateFolder(folder);
    if (!folder) return;
    const parent = folder.split("/").slice(0, -1).join("/");
    if (!(await api.folders(drive, parent)).some((entry) => entry.path === folder)) throw new Error("invalidDestination");
  }
  return async function run(request, sender) {
    if (!request || typeof request !== "object") throw new Error("notAllowed");
    const caller = authorize(sender, request.type);
    if (request.type === "openSettings") { await chromeApi.runtime.openOptionsPage(); return {}; }
    if (request.type === "getSettings") return settings.get();
    if (request.type === "saveSettings") return settings.save(request.origin, request.sttMode);
    const config = await settings.get();
    if (!config.origin) throw new Error("configureServer");
    if (!await chromeApi.permissions.contains({ origins: [hostPattern(config.origin)] })) throw new Error("permissionRequired");
    const api = apiFactory(config.origin);
    if (request.type === "checkConnection") {
      const [auth, drives] = await Promise.all([api.authStatus(), api.drives()]);
      return { driveCount: drives.length, hasProtected: Boolean(auth.has_protected_drives) };
    }
    if (caller.options) throw new Error("notAllowed");
    const current = await context(request, sender, caller, config);
    if (request.type === "bootstrap") {
      const [auth, drives, operation] = await Promise.all([api.authStatus(), api.drives(), operations.find(current)]);
      let lastDestination = config.lastDestination;
      if (lastDestination) {
        try { await checkDrive(api, lastDestination.drive); await checkFolder(api, lastDestination.drive, lastDestination.folder); }
        catch { lastDestination = null; }
      }
      return { origin: config.origin, generation: config.generation, drives: drives.map((drive) => ({ name: validateDrive(drive.name) })), hasProtected: Boolean(auth.has_protected_drives), unlockUrl: `${config.origin}/unlock`, lastDestination, operation: presentOperation(operation && drives.some((drive) => drive.name === operation.drive) ? operation : null) };
    }
    if (request.type === "status") {
      const record = await operations.find(current);
      const drives = await api.drives();
      return { operation: presentOperation(record && drives.some((drive) => drive.name === record.drive) ? record : null) };
    }
    const drive = validateDrive(request.drive);
    const folder = validateFolder(request.folder ?? "");
    await checkDrive(api, drive);
    if (request.type === "drive" || request.type === "children") {
      await checkFolder(api, drive, folder);
      const children = await api.folders(drive, folder);
      return { folders: children.map((entry) => {
        const path = validateFolder(entry.path);
        if (path.split("/").slice(0, -1).join("/") !== folder) throw new Error("requestFailed");
        return { name: String(entry.name), path };
      }) };
    }
    if (request.generation !== config.generation) throw new Error("settingsChanged");
    await checkFolder(api, drive, folder);
    await context(request, sender, caller, await settings.get());
    const reservation = await operations.reserve({ ...current, video: undefined, drive, folder }, request.repeatId);
    if (!reservation.created) return { operation: presentOperation(reservation.operation) };
    let result;
    try {
      await context(request, sender, caller, await settings.get());
      const response = await api.importVideo(current.video, drive, folder, config.sttMode);
      if (typeof response?.file_id !== "string" || !response.file_id || typeof response.filename !== "string" || !response.filename) throw new ApiError("requestFailed", 200, true);
      result = { state: "success", fileId: response.file_id, filename: response.filename };
    } catch (error) {
      result = { state: error instanceof ApiError && error.uncertain ? "unknown" : "error", error: error.code ?? "requestFailed" };
    }
    const finished = await operations.finish(reservation.operation.id, result);
    if (finished.state === "success") await settings.remember(config, { drive, folder }).catch(() => {});
    return { operation: presentOperation(finished) };
  };
}
