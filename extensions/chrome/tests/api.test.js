import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../lib/api.js";

test("Import uses the existing scoped payload with browser credentials", async () => {
  const requests = [];
  const api = createApi("http://localhost:3001", async (url, options) => {
    requests.push({ url, options });
    return Response.json({ file_id: "f1", filename: "Video.loft" });
  });
  await api.importVideo({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, "動画", "папка", "always");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://localhost:3001/api/addons/media_import/link");
  assert.equal(requests[0].options.credentials, "include");
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.headers["X-Lit-Drive"], encodeURIComponent("動画"));
  assert.deepEqual(JSON.parse(requests[0].options.body), { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", drive: "動画", folder_path: "папка", stt_mode: "always" });
});
test("A lost mutation response is uncertain and is never retried", async () => {
  for (const result of [() => { throw new Error("secret raw message"); }, () => new Response("bad", { status: 500 }), () => new Response("not json")]) {
    let calls = 0;
    const api = createApi("http://localhost", async () => { calls++; return result(); });
    await assert.rejects(api.importVideo({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, "drive", "", "manual"), (e) => e.uncertain && !e.message.includes("secret"));
    assert.equal(calls, 1);
  }
});
test("Disabled addon policy is respected", async () => {
  for (const policy of [{ default: false, features: {} }, { default: true, features: { url_import: false } }]) {
    const api = createApi("http://localhost", async (url) => Response.json(url.includes("addon-policies") ? { addons: { media_import: policy } } : { addons: { media_import: {} } }));
    assert.equal(await api.availability("drive"), false);
  }
});
