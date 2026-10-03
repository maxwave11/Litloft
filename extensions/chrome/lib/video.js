const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"]);

export function getVideo(input) {
  try {
    const url = new URL(input);
    if (!YOUTUBE_HOSTS.has(url.hostname) || url.protocol !== "https:" || url.port || url.username || url.password) return null;
    let id;
    if (url.hostname === "youtu.be") id = /^\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
    else if (url.pathname === "/watch") id = url.searchParams.get("v");
    else id = /^\/(?:shorts|live)\/([\w-]{11})\/?$/.exec(url.pathname)?.[1];
    return typeof id === "string" && /^[\w-]{11}$/.test(id)
      ? { id, url: `https://www.youtube.com/watch?v=${id}` }
      : null;
  } catch { return null; }
}
