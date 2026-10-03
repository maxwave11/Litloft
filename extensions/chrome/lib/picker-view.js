const t = (key) => chrome.i18n.getMessage(key) || key;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, key, disabled = false, className = "secondary") {
  const node = element("button", text, className);
  node.type = "button";
  node.disabled = disabled;
  node.dataset.focusKey = key;
  node.addEventListener("click", action);
  return node;
}
function link(text, url) {
  const node = element("a", text);
  node.href = url;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  return node;
}

export function createPickerView(root, actions) {
  return function render(state) {
    const focusKey = (root.getRootNode().activeElement ?? document.activeElement)?.dataset?.focusKey;
    const panel = element("section", undefined, "picker");
    panel.setAttribute("aria-label", t("extensionName"));
    const header = element("header");
    header.append(element("span", "LITLOFT", "eyebrow"));
    header.append(button(t("settingsTitle"), actions.settings, "settings"));
    panel.append(header, element("h2", t("addVideo")));
    if (state.video) panel.append(element("p", state.video.url, "video-url"));
    if (state.operation) {
      const op = state.operation;
      const status = element("p", t(op.state === "success" ? "importSuccess" : op.state === "unknown" ? "importUnknown" : op.state === "pending" ? "importing" : op.error ?? "requestFailed"), `status ${op.state}`);
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      panel.append(status);
      if (op.filename) panel.append(element("p", op.filename, "filename"));
      if (op.drive) panel.append(element("p", `${op.drive} / ${op.folder || t("driveRoot")}`, "hint"));
      if (op.fileUrl || op.folderUrl) panel.append(link(t(op.fileUrl ? "openFile" : "checkFolder"), op.fileUrl ?? op.folderUrl));
      if (op.state !== "pending") panel.append(button(t(op.state === "success" ? "addAnother" : "chooseAgain"), actions.repeat, "repeat"));
    } else if (state.error) {
      const message = element("p", t(state.error), "status error");
      message.setAttribute("role", "alert");
      panel.append(message);
      if (state.video) panel.append(button(t("refresh"), actions.refresh, "refresh"));
    } else if (state.loading) {
      const status = element("p", t("loading"), "status");
      status.setAttribute("role", "status");
      panel.append(status);
    } else if (!state.video) panel.append(element("p", t("unsupportedPage"), "status"));
    else if (!state.drives.length) {
      panel.append(element("p", t("noDrives"), "status"));
      panel.append(button(t("refresh"), actions.refresh, "refresh"));
    } else {
      if (state.drives.length > 1) {
        const label = element("label", t("chooseDrive"));
        const select = element("select");
        select.dataset.focusKey = "drive";
        select.setAttribute("aria-label", t("chooseDrive"));
        const placeholder = element("option", t("chooseDrive"));
        placeholder.value = "";
        select.append(placeholder);
        for (const drive of state.drives) {
          const option = element("option", drive.name);
          option.value = drive.name;
          select.append(option);
        }
        select.value = state.drive ?? "";
        select.addEventListener("change", () => actions.drive(select.value));
        label.append(select);
        panel.append(label);
      }
      if (state.drive) {
        if (state.lastDestination?.drive === state.drive) panel.append(button(`${t("lastDestination")}: ${state.lastDestination.folder || t("driveRoot")}`, () => actions.choose(state.lastDestination.folder), "last", state.busy, "destination"));
        panel.append(element("p", t("chooseFolder"), "hint"));
        panel.append(button(`${state.drive} / ${t("driveRoot")}`, () => actions.choose(""), "root", state.busy, "destination"));
        function appendChildren(path, depth) {
          const folders = state.nodes.get(path);
          if (!folders) { panel.append(element("p", t("loading"), "hint")); return; }
          for (const folder of folders) {
            const row = element("div", undefined, "folder-row");
            row.style.paddingInlineStart = `${depth * 16}px`;
            const expanded = state.expanded.has(folder.path);
            const toggle = button(expanded ? "−" : "+", () => actions.expand(folder.path), `expand:${folder.path}`, state.busy, "expand");
            toggle.setAttribute("aria-label", `${t(expanded ? "collapse" : "expand")} ${folder.name}`);
            toggle.setAttribute("aria-expanded", String(expanded));
            row.append(toggle, button(folder.name, () => actions.choose(folder.path), `folder:${folder.path}`, state.busy, "destination"));
            panel.append(row);
            if (expanded) appendChildren(folder.path, depth + 1);
          }
        }
        appendChildren("", 0);
      }
    }
    if (state.origin && (state.hasProtected || !state.drives.length || state.error)) panel.append(link(t("openLitloft"), `${state.origin}/unlock`));
    const footer = element("footer", t("chooseHint"), "hint");
    panel.append(footer);
    root.replaceChildren(panel);
    if (focusKey) root.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus();
  };
}
