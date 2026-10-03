export function normalizeOrigin(input) {
  if (typeof input !== "string" || !/^https?:\/\/[^/?#\\\s]+\/?$/i.test(input.trim())) throw new Error("invalidServer");
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error("invalidServer"); }
  if (url.username || url.password || /[*%]/.test(url.hostname)) throw new Error("invalidServer");
  return url.origin;
}

export function hostPattern(origin) {
  const url = new URL(normalizeOrigin(origin));
  return `${url.protocol}//${url.hostname}/*`;
}

export function validateDrive(drive) {
  if (typeof drive !== "string" || !drive || /[/\\\u0000-\u001f\u007f]/.test(drive) || drive === "." || drive === "..") throw new Error("invalidDestination");
  return drive;
}

export function validateFolder(path) {
  if (typeof path !== "string" || /[\\\u0000-\u001f\u007f]/.test(path) || /^[A-Za-z]:/.test(path)) throw new Error("invalidDestination");
  if (path && path.split("/").some((segment) => !segment || segment === "." || segment === "..")) throw new Error("invalidDestination");
  return path;
}

export function folderUrl(origin, drive, folder) {
  const path = validateFolder(folder).split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${normalizeOrigin(origin)}/drive/${encodeURIComponent(validateDrive(drive))}${path ? `/${path}` : ""}`;
}

export function fileUrl(origin, drive, folder, fileId) {
  return `${folderUrl(origin, drive, folder)}?${new URLSearchParams({ file: fileId })}`;
}
