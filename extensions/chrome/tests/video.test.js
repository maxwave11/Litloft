import test from "node:test";
import assert from "node:assert/strict";
import { getVideo } from "../lib/video.js";

test("YouTube video pages resolve to one canonical video", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=20&list=123",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
  ]) assert.deepEqual(getVideo(url), { id: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
});
test("Only supported YouTube origins and a single valid video are accepted", () => {
  for (const url of [
    "https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://evil.test/watch?v=dQw4w9WgXcQ", "javascript:alert(1)",
    "https://user:password@www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/playlist?list=abc", "https://www.youtube.com/@user",
    "https://www.youtube.com/watch?v=bad", "https://youtu.be/dQw4w9WgXcQ/extra",
  ]) assert.equal(getVideo(url), null, url);
});
