import { normalizeOrigin, hostPattern } from "./lib/destination.js";

const t = (key) => chrome.i18n.getMessage(key) || key;
document.documentElement.lang = chrome.i18n.getUILanguage();
for (const element of document.querySelectorAll("[data-message]")) element.textContent = t(element.dataset.message);
const form = document.querySelector("form");
const status = document.querySelector("#status");
const origin = document.querySelector("#origin");
const stt = document.querySelector("#stt");
const unlock = document.querySelector("#unlock");
async function send(request) {
  const reply = await chrome.runtime.sendMessage(request);
  if (!reply?.ok) throw new Error(reply?.error ?? "requestFailed");
  return reply.data;
}
function showServer(server) {
  unlock.hidden = !server;
  if (server) unlock.href = `${server}/unlock`;
}
function busy(value) {
  for (const element of form.elements) element.disabled = value;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  busy(true);
  status.textContent = t("saving");
  try {
    const server = normalizeOrigin(origin.value);
    const granted = await chrome.permissions.request({ origins: [hostPattern(server)] });
    if (!granted) throw new Error("permissionRequired");
    const config = await send({ type: "saveSettings", origin: server, sttMode: stt.value });
    origin.value = config.origin;
    showServer(config.origin);
    status.textContent = t("saved");
  } catch (error) { status.textContent = t(error.message); }
  finally { busy(false); }
});
document.querySelector("#check").addEventListener("click", async () => {
  busy(true);
  status.textContent = t("loading");
  try {
    const result = await send({ type: "checkConnection" });
    status.textContent = `${t("connected")} ${result.driveCount} ${t("accessibleDrives")}${result.hasProtected ? ` ${t("unlockHint")}` : ""}`;
  } catch (error) { status.textContent = t(error.message); }
  finally { busy(false); }
});
try {
  const config = await send({ type: "getSettings" });
  origin.value = config.origin ?? "";
  stt.value = config.sttMode;
  showServer(config.origin);
} catch { status.textContent = t("requestFailed"); }
