import test from "node:test";
import assert from "node:assert/strict";
import { createSettings } from "../lib/settings.js";
import { memoryStorage } from "./helpers.js";

test("Server changes clear destinations while permission patterns ignore only ports", async () => {
  const removed = [];
  const storage = memoryStorage();
  const settings = createSettings(storage, { contains: async () => true, remove: async (p) => removed.push(p) });
  const first = await settings.save("http://localhost:3001", "manual");
  await settings.remember(first, { drive: "動画", folder: "a" });
  assert.deepEqual((await settings.get()).lastDestination, { drive: "動画", folder: "a" });
  const second = await settings.save("http://localhost:3002", "always");
  assert.equal(second.lastDestination, null);
  assert.notEqual(first.generation, second.generation);
  assert.deepEqual(removed, []);
  await settings.save("https://litloft.test", "manual");
  assert.deepEqual(removed, [{ origins: ["http://localhost/*"] }]);
  await settings.remember(first, { drive: "動画", folder: "stale" });
  assert.equal((await settings.get()).lastDestination, null);
});
test("Missing host permission prevents saving a server", async () => {
  const settings = createSettings(memoryStorage(), { contains: async () => false });
  await assert.rejects(settings.save("http://localhost", "manual"), /permissionRequired/);
});
