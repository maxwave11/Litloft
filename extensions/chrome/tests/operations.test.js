import test from "node:test";
import assert from "node:assert/strict";
import { createOperations } from "../lib/operations.js";
import { memoryStorage } from "./helpers.js";

const context = { origin: "http://localhost", generation: "g1", tabId: 1, videoId: "dQw4w9WgXcQ", drive: "drive", folder: "" };
test("Both interfaces reserve one active import, including reopening the UI", async () => {
  const operations = createOperations(memoryStorage());
  const [a, b] = await Promise.all([operations.reserve(context), operations.reserve(context)]);
  assert.equal([a, b].filter((o) => o.created).length, 1);
  assert.equal(a.operation.id, b.operation.id);
  for (const repeatId of [undefined, a.operation.id]) {
    for (const destination of [context, { ...context, drive: "another", folder: "nested" }]) {
      const pending = await operations.reserve(destination, repeatId);
      assert.equal(pending.created, false);
      assert.equal(pending.operation.id, a.operation.id);
    }
  }
  await operations.finish(a.operation.id, { state: "success", fileId: "f1", filename: "video.loft" });
  const reopened = await operations.reserve(context);
  assert.equal(reopened.created, false);
  assert.equal(reopened.operation.state, "success");
  const repeated = await operations.reserve(context, a.operation.id);
  assert.equal(repeated.created, true);
});
test("Worker restart records an unknown result without reserving a replacement", async () => {
  const storage = memoryStorage();
  const previous = await createOperations(storage).reserve(context);
  const restarted = createOperations(storage);
  const found = await restarted.find(context);
  assert.equal(found.state, "unknown");
  const request = await restarted.reserve(context);
  assert.equal(request.created, false);
  assert.equal(request.operation.id, previous.operation.id);
});
test("A late response updates its own operation, not another server's", async () => {
  const operations = createOperations(memoryStorage());
  const a = await operations.reserve(context);
  const other = { ...context, origin: "http://other" };
  const b = await operations.reserve(other);
  await operations.finish(a.operation.id, { state: "success", fileId: "f1" });
  assert.equal((await operations.find(other)).id, b.operation.id);
  assert.equal((await operations.find(other)).state, "pending");
});
