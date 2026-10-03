import { normalizeOrigin, validateDrive, validateFolder } from "./destination.js";

export class ApiError extends Error {
  constructor(code, status = 0, uncertain = false) {
    super(code);
    this.code = code;
    this.status = status;
    this.uncertain = uncertain;
  }
}

export function createApi(origin, fetcher = fetch) {
  origin = normalizeOrigin(origin);
  async function request(path, options = {}) {
    const mutation = options.method === "POST";
    let response;
    try {
      response = await fetcher(`${origin}/api${path}`, {
        credentials: "include", redirect: "error", cache: "no-store",
        signal: AbortSignal.timeout(mutation ? 25000 : 10000), ...options,
      });
      if (!response.ok) throw new ApiError(response.status === 404 ? "unavailable" : "requestFailed", response.status, mutation && response.status >= 500);
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("connectionError", response?.status ?? 0, mutation);
    }
  }
  const drivePath = (drive) => `/drives/${encodeURIComponent(validateDrive(drive))}`;
  return {
    authStatus: () => request("/auth/status"),
    drives: () => request("/drives"),
    availability: async (drive) => {
      const [catalogue, policies] = await Promise.all([
        request(`/addons/status?${new URLSearchParams({ drive: validateDrive(drive) })}`),
        request(`${drivePath(drive)}/addon-policies`),
      ]);
      const policy = policies.addons?.media_import;
      return Boolean(catalogue.addons?.media_import) && (policy?.features?.url_import ?? policy?.default ?? true);
    },
    folders: (drive, path = "") => request(`${drivePath(drive)}/folders?${new URLSearchParams({ path: validateFolder(path) })}`),
    importVideo: (video, drive, folder, sttMode) => request("/addons/media_import/link", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Lit-Drive": encodeURIComponent(validateDrive(drive)) },
      body: JSON.stringify({ url: video.url, drive, folder_path: validateFolder(folder), stt_mode: sttMode }),
    }),
  };
}
