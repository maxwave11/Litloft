import { getVideo } from "./lib/video.js";
import { mountPicker } from "./lib/picker.js";

document.documentElement.lang = chrome.i18n.getUILanguage();
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const controller = mountPicker(document.querySelector("#picker"), getVideo(tab?.url), tab?.id);
chrome.tabs.onUpdated.addListener((id, change) => {
  if (id === tab?.id && change.url && getVideo(change.url)?.id !== getVideo(tab.url)?.id) {
    controller.dispose();
    mountPicker(document.querySelector("#picker"), null, tab?.id);
  }
});
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
