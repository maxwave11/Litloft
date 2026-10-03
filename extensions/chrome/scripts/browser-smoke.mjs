import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, rm, readFile, mkdir, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "@playwright/test");
let extension = resolve(fileURLToPath(new URL("..", import.meta.url)));
const profile = await mkdtemp(join(tmpdir(), "litloft-extension-smoke-"));
const output = resolve(process.env.SMOKE_OUTPUT || join(profile, "screenshots"));
await mkdir(output, { recursive: true });
if (process.env.SMOKE_PREGRANT === "1") {
  const copy = join(profile, "extension");
  await cp(extension, copy, { recursive: true });
  const manifest = JSON.parse(await readFile(join(copy, "manifest.json"), "utf8"));
  manifest.host_permissions = [...(manifest.host_permissions ?? []), "http://127.0.0.1/*"];
  await writeFile(join(copy, "manifest.json"), JSON.stringify(manifest));
  extension = copy;
}
const requests = [];
let delay = 0;
let failImport = false;
const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  const unlocked = request.headers.cookie?.includes("access_token=fixture") ?? false;
  const drives = [{ name: "Public" }, ...(unlocked ? [{ name: "動画" }] : [])];
  if (url.pathname === "/unlock") {
    const cookies = process.env.SMOKE_BACKEND
      ? (await fetch(`${process.env.SMOKE_BACKEND}/api/auth/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "smoke-fixture" }) })).headers.getSetCookie()
      : ["access_token=fixture; HttpOnly; SameSite=Strict; Path=/"];
    response.setHeader("Set-Cookie", [...cookies, "lit_viewer=smoke-viewer; SameSite=Strict; Path=/"]);
    response.end("<!doctype html><title>Litloft fixture</title>Unlocked"); return;
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  if (url.pathname === "/api/addons/media_import/link" && request.method === "POST") {
    requests.push({ body: JSON.parse(body), cookie: request.headers.cookie, drive: request.headers["x-lit-drive"] });
    if (delay) await new Promise((r) => setTimeout(r, delay));
    if (failImport || !process.env.SMOKE_BACKEND) {
      response.writeHead(failImport ? 500 : 200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(failImport ? { detail: "failed" } : { file_id: `file${requests.length}`, filename: "Fixture video.loft" })); return;
    }
  }
  if (process.env.SMOKE_BACKEND && url.pathname.startsWith("/api/")) {
    const upstream = await fetch(`${process.env.SMOKE_BACKEND}${request.url}`, { method: request.method, headers: { "Content-Type": "application/json", Cookie: request.headers.cookie ?? "", "X-Lit-Drive": request.headers["x-lit-drive"] ?? "" }, ...(body ? { body } : {}) });
    response.writeHead(upstream.status, { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" });
    response.end(await upstream.text()); return;
  }
  let data;
  if (url.pathname === "/api/auth/status") data = { has_protected_drives: true };
  else if (url.pathname === "/api/drives") data = drives;
  else if (url.pathname === "/api/addons/status") data = { addons: { media_import: {} } };
  else if (url.pathname.endsWith("/addon-policies")) data = { addons: {} };
  else if (url.pathname.endsWith("/folders")) {
    const path = url.searchParams.get("path") ?? "";
    data = path === "" ? [{ name: "日本語", path: "日本語" }, { name: "Empty", path: "Empty" }]
      : path === "日本語" ? [{ name: "Nested", path: "日本語/Nested" }] : [];
  } else { response.writeHead(404); response.end(); return; }
  response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(data));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : { channel: "chromium" }), headless: true,
    ignoreDefaultArgs: ["--disable-extensions", "--disable-back-forward-cache"],
    args: process.env.SMOKE_CDP === "1" ? ["--enable-unsafe-extension-debugging"] : [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  if (process.env.SMOKE_CDP === "1") {
    const cdp = await context.browser().newBrowserCDPSession();
    await cdp.send("Extensions.loadUnpacked", { path: extension });
    await cdp.detach();
  }
  const errors = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const extensionId = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator("#origin").fill(origin);
  await options.getByRole("button", { name: "Save and allow access" }).click();
  await options.getByRole("status").filter({ hasText: "Saved." }).waitFor({ timeout: 15000 });
  await options.getByRole("button", { name: "Check connection" }).click();
  await options.getByRole("status").filter({ hasText: "Connected. 1" }).waitFor();
  await options.screenshot({ path: join(output, "options.png") });
  const unlock = await context.newPage();
  await unlock.goto(`${origin}/unlock`);
  await options.bringToFront();
  await options.getByRole("button", { name: "Check connection" }).click();
  await options.getByRole("status").filter({ hasText: "Connected. 2" }).waitFor();
  await context.route("https://www.youtube.com/**", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><title>Fixture YouTube</title><style>body{margin:40px;font:16px system-ui}ytd-watch-metadata{display:block}#actions{margin-top:60px}</style><h1>Fixture video</h1><ytd-watch-metadata><div id="actions"><div id="top-level-buttons-computed"></div></div></ytd-watch-metadata>' }));
  const youtube = await context.newPage();
  await youtube.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await youtube.locator("litloft-add-video").waitFor();
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
  await youtube.locator("litloft-add-video").click();
  await youtube.waitForFunction(() => document.querySelector("litloft-add-video").getBoundingClientRect().width < 200);
  await youtube.screenshot({ path: join(output, "youtube.png") });
  await youtube.keyboard.press("Escape");
  const documentToken = await youtube.evaluate(() => {
    window.smokeToken = crypto.randomUUID();
    window.addEventListener("pageshow", (event) => { window.smokeRestored = event.persisted; });
    return window.smokeToken;
  });
  await youtube.goto(`${origin}/unlock`);
  await youtube.goBack({ waitUntil: "commit" });
  await youtube.waitForFunction(() => window.smokeRestored === true);
  assert.equal(await youtube.evaluate(() => window.smokeToken), documentToken);
  assert.equal(await youtube.evaluate(() => window.smokeRestored), true);
  await youtube.locator("litloft-add-video").waitFor({ timeout: 5000 });
  assert.equal(await youtube.locator("litloft-add-video").count(), 1);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await youtube.bringToFront();
  await popup.evaluate(async ({ id, videoId }) => {
    const { mountPicker } = await import("./lib/picker.js");
    globalThis.smokePicker = mountPicker(document.querySelector("#picker"), { id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` }, id);
  }, { id: tabId, videoId: "dQw4w9WgXcQ" });
  await youtube.bringToFront();
  await popup.getByLabel("Choose a drive").selectOption("動画");
  await popup.getByRole("button", { name: "Expand 日本語", exact: true }).click();
  assert.equal(requests.length, 0);
  await popup.getByRole("button", { name: "Nested", exact: true }).click();
  await popup.getByRole("status").filter({ hasText: "Added." }).waitFor();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.folder_path, "日本語/Nested");
  assert.equal(requests[0].drive, encodeURIComponent("動画"));
  assert.match(requests[0].cookie, /access_token=/);
  assert.match(requests[0].cookie, /lit_viewer=smoke-viewer/);
  await popup.screenshot({ path: join(output, "success.png") });
  if (process.env.SMOKE_BACKEND) {
    const href = await popup.getByRole("link", { name: "Open added video" }).getAttribute("href");
    const fileId = new URL(href).searchParams.get("file");
    const headers = { Cookie: requests[0].cookie, "X-Lit-Drive": requests[0].drive };
    const baseline = await (await fetch(`${origin}/api/addons/media_import/link`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(requests[0].body) })).json();
    for (const id of [fileId, baseline.file_id]) {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const meta = await (await fetch(`${origin}/api/addons/media_import/link/${id}/metadata`, { headers })).json();
        const comments = await (await fetch(`${origin}/api/addons/media_import/link/${id}/comments`, { headers })).json();
        if (meta.captions_downloaded && comments.state === "ready") { ready = true; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.equal(ready, true, `Production processing did not finish for ${id}`);
    }
    requests.pop();
  }
  await popup.getByRole("button", { name: "Add another copy" }).click();
  await popup.getByRole("button", { name: "Empty", exact: true }).waitFor();
  failImport = true;
  await popup.getByRole("button", { name: "Empty", exact: true }).click();
  await popup.getByRole("status").filter({ hasText: "not confirmed" }).waitFor();
  assert.equal(requests.length, 2);
  await popup.screenshot({ path: join(output, "unknown.png") });
  await youtube.evaluate(() => { history.pushState({}, "", "/watch?v=abcdefghijk"); document.dispatchEvent(new Event("yt-navigate-finish")); });
  assert.equal(await youtube.locator("litloft-add-video").count(), 1);
  await youtube.evaluate(() => { history.pushState({}, "", "/@fixture"); document.dispatchEvent(new Event("yt-navigate-finish")); });
  await youtube.locator("litloft-add-video").waitFor({ state: "detached" });
  let liveYouTube = "not requested";
  if (process.env.SMOKE_LIVE_YOUTUBE === "1") {
    await context.unrouteAll();
    try {
      await youtube.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ", { waitUntil: "domcontentloaded", timeout: 30000 });
      await youtube.locator("litloft-add-video").waitFor({ timeout: 20000 });
      await youtube.locator("litloft-add-video").click();
      await youtube.screenshot({ path: join(output, "live-youtube.png") });
      liveYouTube = "page button available";
    } catch (error) {
      liveYouTube = `unverified: ${error.name}`;
      await youtube.screenshot({ path: join(output, "live-youtube-unverified.png") }).catch(() => {});
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ browser: context.browser()?.version(), pregrantedTestHost: process.env.SMOKE_PREGRANT === "1", origin, extensionId, imports: requests.length, liveYouTube, checks: ["configured host permission", "strict access/viewer cookies", "locked drives", "BFCache restoration", "popup controller", "folder expansion without POST", "Unicode nested import", "success", "5xx unknown without retry", "SPA removal"], screenshots: output }));
} catch (error) {
  for (const [index, page] of (context?.pages() ?? []).entries()) {
    console.error("SMOKE_PAGE", page.url(), await page.locator("body").innerText().catch(() => ""));
    await page.screenshot({ path: join(output, `failure-${index}.png`) }).catch(() => {});
  }
  throw error;
} finally {
  await context?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await rm(profile, { recursive: true, force: true });
}
