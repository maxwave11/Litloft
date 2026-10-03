import { createSettings } from "./lib/settings.js";
import { createOperations } from "./lib/operations.js";
import { createCommands } from "./lib/commands.js";

const settings = createSettings(chrome.storage.local, chrome.permissions);
const ready = settings.get().then(() => createCommands({ chromeApi: chrome, settings, operations: createOperations(chrome.storage.local) }));
const errors = new Set(["invalidServer", "invalidDestination", "invalidSettings", "permissionRequired", "notAllowed", "configureServer", "staleVideo", "settingsChanged", "unavailable", "importUnavailable", "requestFailed", "connectionError"]);

chrome.runtime.onMessage.addListener((request, sender, reply) => {
  ready.then((run) => run(request, sender)).then(
    (data) => reply({ ok: true, data }),
    (error) => reply({ ok: false, error: errors.has(error.code ?? error.message) ? error.code ?? error.message : "requestFailed" }),
  );
  return true;
});
