(async () => {
  const { getVideo } = await import(chrome.runtime.getURL("lib/video.js"));
  const { mountPicker } = await import(chrome.runtime.getURL("lib/picker.js"));
  const host = document.createElement("litloft-add-video");
  const shadow = host.attachShadow({ mode: "closed" });
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = chrome.runtime.getURL("styles/picker.css");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-button";
  button.textContent = "Add to Litloft";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "dialog");
  shadow.append(css, button);
  let video;
  let popover;
  let portal;
  let controller;
  let queued = false;
  function close() {
    controller?.dispose(); controller = null;
    popover?.remove(); popover = null;
    portal?.remove(); portal = null;
    button.setAttribute("aria-expanded", "false");
  }
  function position() {
    if (!popover) return;
    const bounds = button.getBoundingClientRect();
    popover.style.left = `${Math.max(16, Math.min(bounds.left, innerWidth - 416))}px`;
    const below = bounds.bottom + 8;
    if (below + 240 < innerHeight) { popover.style.top = `${below}px`; popover.style.bottom = "auto"; popover.style.maxHeight = `${innerHeight - below - 16}px`; }
    else { popover.style.top = "auto"; popover.style.bottom = "16px"; popover.style.maxHeight = "calc(100vh - 32px)"; }
  }
  button.addEventListener("click", () => {
    if (popover) { close(); return; }
    const current = getVideo(location.href);
    if (!current || current.id !== video?.id) { update(); return; }
    popover = document.createElement("div");
    popover.className = "page-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Add to Litloft");
    portal = document.createElement("litloft-picker");
    portal.style.cssText = "position:fixed;top:0;left:0;z-index:2147483647;width:0;height:0";
    const portalShadow = portal.attachShadow({ mode: "closed" });
    portalShadow.append(css.cloneNode(), popover);
    document.body.append(portal);
    button.setAttribute("aria-expanded", "true");
    controller = mountPicker(popover, current);
    position();
  });
  document.addEventListener("pointerdown", (event) => { if (popover && !event.composedPath().includes(host) && !event.composedPath().includes(portal)) close(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && popover) { close(); button.focus(); } });
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, { passive: true });
  function update() {
    queued = false;
    const current = getVideo(location.href);
    if (current?.id !== video?.id) close();
    video = current;
    if (!video) { host.remove(); return; }
    let anchor;
    if (location.pathname.startsWith("/shorts/")) anchor = document.querySelector("ytd-reel-video-renderer[is-active] #actions, ytd-reel-video-renderer[is-active] .ytReelActionsViewModelHost");
    else anchor = document.querySelector("ytd-watch-metadata #actions #top-level-buttons-computed, ytd-watch-metadata #actions, #watch7-user-header");
    if (!anchor) { close(); host.remove(); return; }
    if (host.parentNode !== anchor) { close(); anchor.append(host); }
    position();
  }
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }
  const observer = new MutationObserver(queue);
  function start() {
    observer.observe(document.body, { childList: true, subtree: true });
    update();
  }
  document.addEventListener("yt-navigate-finish", queue);
  window.addEventListener("popstate", queue);
  window.addEventListener("pagehide", () => { observer.disconnect(); close(); host.remove(); });
  window.addEventListener("pageshow", start);
  start();
})();
