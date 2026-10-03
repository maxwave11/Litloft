import test from "node:test";
import assert from "node:assert/strict";
import { createPickerController } from "../lib/picker.js";

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}
test("Browsing folders never imports; rapid selections send a single request", async () => {
  const messages = [];
  const pending = deferred();
  const controller = createPickerController({ video: { id: "dQw4w9WgXcQ" }, tabId: 1, render: () => {}, send: async (request) => {
    messages.push(request);
    if (request.type === "bootstrap") return { drives: [{ name: "drive" }], generation: "g1", operation: null };
    if (request.type === "import") return pending.promise;
    return { folders: [{ name: "a", path: "a" }] };
  } });
  await controller.start();
  await controller.expand("a");
  assert.equal(messages.filter((m) => m.type === "import").length, 0);
  const first = controller.choose("a");
  const second = controller.choose("a");
  assert.equal(messages.filter((m) => m.type === "import").length, 1);
  pending.resolve({ operation: { id: "op1", state: "success" } });
  await Promise.all([first, second]);
  controller.dispose();
});
test("A response from an old drive cannot replace the new drive's folders", async () => {
  const old = deferred();
  let state;
  const controller = createPickerController({ video: { id: "dQw4w9WgXcQ" }, render: (s) => { state = structuredClone(s); }, send: async (request) => {
    if (request.type === "bootstrap") return { drives: [{ name: "old" }, { name: "new" }], generation: "g1" };
    if (request.drive === "old") return old.promise;
    return { folders: [{ name: "new folder", path: "new folder" }] };
  } });
  await controller.start();
  const first = controller.drive("old");
  await controller.drive("new");
  old.resolve({ folders: [{ name: "old folder", path: "old folder" }] });
  await first;
  assert.equal(state.drive, "new");
  assert.deepEqual(state.nodes.get(""), [{ name: "new folder", path: "new folder" }]);
  controller.dispose();
});
test("Disposing a picker prevents its pending response from changing the next video", async () => {
  const pending = deferred();
  const renders = [];
  const controller = createPickerController({ video: { id: "dQw4w9WgXcQ" }, render: (state) => renders.push(structuredClone(state)), send: () => pending.promise });
  const started = controller.start();
  controller.dispose();
  pending.resolve({ drives: [{ name: "drive" }], generation: "g1" });
  await started;
  assert.equal(renders.length, 1);
});

test("An inaccessible operation shows an access error without retrying the import", async () => {
  let state;
  let imports = 0;
  const controller = createPickerController({ video: { id: "dQw4w9WgXcQ" }, render: (s) => { state = structuredClone(s); }, send: async (request) => {
    if (request.type === "bootstrap") return { drives: [{ name: "drive" }], generation: "g1" };
    if (request.type === "import") { imports++; throw new Error("unavailable"); }
    if (request.type === "status") return { operation: null };
    return { folders: [] };
  } });
  await controller.start();
  await controller.choose("");
  assert.equal(state.operation, null);
  assert.equal(state.error, "unavailable");
  assert.equal(imports, 1);
  controller.dispose();
});
