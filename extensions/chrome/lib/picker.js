import { createPickerView } from "./picker-view.js";

export function createPickerController({ video, tabId, send, render, schedule = setTimeout, cancel = clearTimeout }) {
  let revision = 0;
  let timer;
  let disposed = false;
  let repeatId;
  const state = { video, drives: [], nodes: new Map(), expanded: new Set(), loading: false, busy: false, operation: null, error: null, drive: null };
  const publish = () => { if (!disposed) render(state); };
  const message = (type, extra = {}) => send({ type, tabId, videoId: video?.id, generation: state.generation, ...extra });
  function poll() {
    cancel(timer);
    if (state.operation?.state !== "pending" || disposed) return;
    const expected = revision;
    timer = schedule(async () => {
      try {
        const result = await message("status");
        if (!disposed && expected === revision) { state.operation = result.operation; publish(); poll(); }
      } catch (error) {
        if (!disposed && expected === revision) { state.error = error.message; state.operation = null; publish(); }
      }
    }, 1000);
  }
  async function refresh(preserveRepeat = false) {
    if (disposed) return;
    const expected = ++revision;
    cancel(timer);
    state.error = null; state.operation = null; state.loading = true; state.busy = false;
    state.generation = undefined;
    if (!preserveRepeat) repeatId = undefined;
    publish();
    if (!video) { state.loading = false; publish(); return; }
    try {
      const result = await message("bootstrap");
      if (disposed || expected !== revision) return;
      Object.assign(state, result, { loading: false, drive: null, nodes: new Map(), expanded: new Set() });
      if (preserveRepeat) state.operation = null;
      if (state.operation) { publish(); poll(); return; }
      if (state.drives.length === 1) await selectDrive(state.drives[0].name);
      else if (state.lastDestination) await selectDrive(state.lastDestination.drive);
      else publish();
    } catch (error) {
      if (!disposed && expected === revision) { state.loading = false; state.error = error.message; publish(); }
    }
  }
  async function selectDrive(drive) {
    if (disposed || state.busy) return;
    const expected = ++revision;
    state.drive = drive || null; state.error = null; state.nodes = new Map(); state.expanded = new Set();
    if (!drive) { publish(); return; }
    state.loading = true; publish();
    try {
      const result = await message("drive", { drive, folder: "" });
      if (!disposed && expected === revision) { state.nodes.set("", result.folders); state.loading = false; publish(); }
    } catch (error) {
      if (!disposed && expected === revision) { state.loading = false; state.error = error.message; publish(); }
    }
  }
  async function expand(folder) {
    if (disposed || state.busy) return;
    if (state.expanded.has(folder)) { state.expanded.delete(folder); publish(); return; }
    const expected = revision;
    state.expanded.add(folder); publish();
    if (state.nodes.has(folder)) return;
    try {
      const result = await message("children", { drive: state.drive, folder });
      if (!disposed && expected === revision) { state.nodes.set(folder, result.folders); publish(); }
    } catch (error) {
      if (!disposed && expected === revision) { state.expanded.delete(folder); state.error = error.message; publish(); }
    }
  }
  async function choose(folder) {
    if (disposed || state.busy || !state.drive) return;
    const expected = revision;
    state.busy = true; state.operation = { state: "pending", drive: state.drive, folder }; publish();
    try {
      const result = await message("import", { drive: state.drive, folder, repeatId });
      if (!disposed && expected === revision) { state.operation = result.operation; state.busy = false; publish(); poll(); }
    } catch (error) {
      if (disposed || expected !== revision) return;
      try {
        const result = await message("status");
        if (disposed || expected !== revision) return;
        state.operation = result.operation;
      } catch { state.operation = null; }
      if (!state.operation) state.error = error.message;
      state.busy = false; publish(); poll();
    }
  }
  return {
    start: refresh, refresh: () => refresh(), drive: selectDrive, expand, choose,
    repeat: async () => { repeatId = state.operation?.id; await refresh(true); },
    settings: () => send({ type: "openSettings" }).catch(() => {}),
    dispose: () => { disposed = true; revision++; cancel(timer); },
  };
}

export function mountPicker(root, video, tabId) {
  let controller;
  const view = createPickerView(root, {
    refresh: () => controller.refresh(), drive: (drive) => controller.drive(drive),
    expand: (folder) => controller.expand(folder), choose: (folder) => controller.choose(folder),
    repeat: () => controller.repeat(), settings: () => controller.settings(),
  });
  controller = createPickerController({ video, tabId, render: view, send: async (request) => {
    let reply;
    try { reply = await chrome.runtime.sendMessage(request); } catch { throw new Error("connectionError"); }
    if (!reply?.ok) throw new Error(reply?.error ?? "requestFailed");
    return reply.data;
  } });
  controller.start();
  return controller;
}
