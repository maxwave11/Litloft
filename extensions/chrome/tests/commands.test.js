import test from "node:test";
import assert from "node:assert/strict";
import { createCommands } from "../lib/commands.js";
import { createSettings } from "../lib/settings.js";
import { createOperations } from "../lib/operations.js";
import { memoryStorage } from "./helpers.js";

async function fixture() {
  const storage = memoryStorage();
  const settings = createSettings(storage, { contains: async () => true, remove: async () => {} });
  const config = await settings.save("http://localhost:3001", "manual");
  const calls = [];
  const state = { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", accessible: true, available: true };
  const api = {
    authStatus: async () => ({ has_protected_drives: true }),
    drives: async () => state.accessible ? [{ name: "動画" }] : [],
    availability: async () => state.available,
    folders: async (drive, path) => path === "" ? [{ name: "子", path: "子" }] : [],
    importVideo: async (...args) => { calls.push(args); return { file_id: "f1", filename: "video.loft" }; },
  };
  const chromeApi = { runtime: { id: "test", getURL: (p) => `chrome-extension://test/${p}`, openOptionsPage: async () => {} }, tabs: { get: async () => ({ id: 1, url: state.url, active: true }) }, permissions: { contains: async () => true } };
  const run = createCommands({ chromeApi, settings, operations: createOperations(storage), apiFactory: () => api });
  const sender = { id: "test", url: "chrome-extension://test/popup.html" };
  const request = { type: "import", tabId: 1, videoId: "dQw4w9WgXcQ", generation: config.generation, drive: "動画", folder: "子" };
  return { run, sender, request, calls, state, config, settings, storage, api };
}
test("Untrusted senders and content scripts cannot change settings or select arbitrary URLs", async () => {
  const f = await fixture();
  for (const sender of [{ id: "other", url: f.sender.url }, { id: "test", url: "https://evil.test" }, { id: "test", url: f.state.url, tab: { id: 1 }, frameId: 2 }]) await assert.rejects(f.run(f.request, sender), /notAllowed/);
  await assert.rejects(f.run({ type: "saveSettings", origin: "http://evil.test", sttMode: "manual" }, { id: "test", url: f.state.url, tab: { id: 1 }, frameId: 0 }), /notAllowed/);
  await assert.rejects(f.run({ ...f.request, type: "fetch", url: "http://evil.test" }, f.sender), /notAllowed/);
  assert.equal(f.calls.length, 0);
});
test("Folder browsing does not import, while duplicate selections share a single operation", async () => {
  const f = await fixture();
  await f.run({ ...f.request, type: "children", folder: "" }, f.sender);
  assert.equal(f.calls.length, 0);
  const [a, b] = await Promise.all([f.run(f.request, f.sender), f.run(f.request, f.sender)]);
  assert.equal(f.calls.length, 1);
  assert.equal(a.operation.id, b.operation.id);
  assert.equal(f.calls[0][2], "子");
});
test("Stale video, generation, locked drive, disabled addon and absent folder prevent writes", async () => {
  for (const change of [
    (f) => { f.state.url = "https://www.youtube.com/watch?v=abcdefghijk"; },
    (f) => { f.request.generation = "old"; },
    (f) => { delete f.request.generation; },
    (f) => { f.state.accessible = false; },
    (f) => { f.state.available = false; },
    (f) => { f.request.folder = "absent"; },
    (f) => { f.request.folder = "../outside"; },
  ]) {
    const f = await fixture(); change(f);
    await assert.rejects(f.run(f.request, f.sender));
    assert.equal(f.calls.length, 0);
  }
});

test("Locking a drive hides saved operation details across all picker commands", async () => {
  for (const { drives, timing } of [
    { drives: [], timing: "after" },
    { drives: [], timing: "during" },
    { drives: [{ name: "Public" }], timing: "after" },
    { drives: [{ name: "Public" }], timing: "during" },
  ]) {
    const f = await fixture();
    if (timing === "during") {
      const importVideo = f.api.importVideo;
      f.api.importVideo = async (...args) => {
        const result = await importVideo(...args);
        f.api.drives = async () => drives;
        return result;
      };
    }
    const initial = await f.run(f.request, f.sender);
    if (timing === "during") assert.equal(initial.operation, null);
    f.api.drives = async () => drives;
    const boot = await f.run({ ...f.request, type: "bootstrap" }, f.sender);
    const status = await f.run({ ...f.request, type: "status" }, f.sender);
    assert.deepEqual(boot.drives, drives);
    assert.equal(boot.lastDestination, null);
    assert.equal(boot.operation, null);
    assert.equal(status.operation, null);
    if (drives.length) {
      const selection = await f.run({ ...f.request, drive: "Public", folder: "" }, f.sender);
      assert.equal(selection.operation, null);
      assert.equal(f.calls.length, 1);
    }
  }
});

test("Navigation during journal reservation stops an import before it is sent", async () => {
  const f = await fixture();
  const persist = f.storage.set.bind(f.storage);
  f.storage.set = async (values) => {
    await persist(values);
    if (values.operations?.some((operation) => operation.state === "pending")) f.state.url = "https://www.youtube.com/watch?v=abcdefghijk";
  };
  const result = await f.run(f.request, f.sender);
  assert.equal(f.calls.length, 0);
  assert.equal(result.operation.state, "error");
});

test("Invalid creation confirmations remain unknown and cannot trigger an automatic retry", async () => {
  for (const response of [{}, { file_id: "", filename: "video.loft" }, { file_id: "f1", filename: "" }, { file_id: 123, filename: "video.loft" }]) {
    const f = await fixture();
    f.api.importVideo = async () => { f.calls.push(response); return response; };
    const result = await f.run(f.request, f.sender);
    assert.equal(result.operation.state, "unknown");
    const reopened = await f.run(f.request, f.sender);
    assert.equal(reopened.operation.id, result.operation.id);
    assert.equal(f.calls.length, 1);
  }
});
