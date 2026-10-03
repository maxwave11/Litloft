import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExportSectionProvider, SectionResult } from "@/lib/exportSections";
import type { FileItem } from "@/types";

import { MAX_EXPORT_FILES, runExport } from "../runExport";

function file(id: string, over: Partial<FileItem> = {}): FileItem {
  return { id, filename: `${id}.mp4`, title: id, file_type: "video", ...over } as FileItem;
}

function provider(
  id: string,
  build: ExportSectionProvider["build"],
): ExportSectionProvider {
  return { id, label: id, order: 10, build };
}

const section = (markdown: string): SectionResult => ({ kind: "section", markdown });
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runExport", () => {
  it("returns the files in the order given, whichever finishes first", async () => {
    const files = Array.from({ length: 8 }, (_, i) => file(`f${i}`));
    const slowFirst = provider("p", async (f) => {
      await tick(8 - Number(f.id.slice(1)));
      return section(f.id);
    });

    const result = await runExport({
      files,
      drive: "d",
      providers: [slowFirst],
      signal: new AbortController().signal,
    });

    expect(result?.files.map((f) => f.file.id)).toEqual(files.map((f) => f.id));
    expect(result?.files.map((f) => f.outcomes.p)).toEqual(files.map((f) => section(f.id)));
  });

  it("records a throwing provider as a failure for that file only", async () => {
    const files = [file("a"), file("b")];
    const flaky = provider("flaky", async (f) => {
      if (f.id === "b") throw new Error("boom");
      return section("ok");
    });
    const steady = provider("steady", async () => section("fine"));

    const result = await runExport({
      files,
      drive: "d",
      providers: [flaky, steady],
      signal: new AbortController().signal,
    });

    expect(result?.files.map((f) => f.outcomes)).toEqual([
      { flaky: section("ok"), steady: section("fine") },
      { flaky: { kind: "failed" }, steady: section("fine") },
    ]);
  });

  it("works on four files at a time", async () => {
    let running = 0;
    let peak = 0;
    const watched = provider("p", async () => {
      running += 1;
      peak = Math.max(peak, running);
      await tick(2);
      running -= 1;
      return { kind: "empty" };
    });

    await runExport({
      files: Array.from({ length: 12 }, (_, i) => file(`f${i}`)),
      drive: "d",
      providers: [watched],
      signal: new AbortController().signal,
    });

    expect(peak).toBe(4);
  });

  it("starts no further file after the signal aborts, and returns nothing", async () => {
    const controller = new AbortController();
    const build = vi.fn(async () => {
      if (build.mock.calls.length === 2) controller.abort();
      await tick(1);
      return section("x");
    });

    const result = await runExport({
      files: Array.from({ length: 12 }, (_, i) => file(`f${i}`)),
      drive: "d",
      providers: [provider("p", build)],
      signal: controller.signal,
    });

    expect(result).toBeNull();
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("reads the original link of a .loft and nothing for other files", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ provider: "youtube", url: "https://youtu.be/abc" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runExport({
      files: [file("a", { filename: "A.LOFT" }), file("b")],
      drive: "d",
      providers: [],
      signal: new AbortController().signal,
    });

    expect(result?.files.map((f) => f.originalUrl)).toEqual(["https://youtu.be/abc", null]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["answers with an error status", async () => ({ ok: false, json: async () => ({}) })],
    ["cannot be read", async () => Promise.reject(new Error("offline"))],
    ["holds no url", async () => ({ ok: true, json: async () => ({ provider: "x" }) })],
  ])("still builds the sections of a .loft whose link %s", async (_, answer) => {
    vi.stubGlobal("fetch", vi.fn(answer));

    const result = await runExport({
      files: [file("a", { filename: "a.loft" })],
      drive: "d",
      providers: [provider("p", async () => section("t"))],
      signal: new AbortController().signal,
    });

    expect(result?.files[0].originalUrl).toBeNull();
    expect(result?.files[0].outcomes.p).toEqual(section("t"));
  });

  it("counts files that are not video or audio, and those over the cap", async () => {
    const media = Array.from({ length: MAX_EXPORT_FILES + 3 }, (_, i) => file(`v${i}`));
    const files = [
      media[0],
      file("pic", { file_type: "image" }),
      file("doc", { file_type: "document" }),
      file("song", { file_type: "audio" }),
      ...media.slice(1),
    ];

    const result = await runExport({
      files,
      drive: "d",
      providers: [],
      signal: new AbortController().signal,
    });

    expect(result?.files).toHaveLength(MAX_EXPORT_FILES);
    expect(result?.files.map((f) => f.file.id).slice(0, 2)).toEqual(["v0", "song"]);
    expect(result?.notMedia).toBe(2);
    expect(result?.overCap).toBe(4);
  });

  it("reports progress up to the number of files it will build", async () => {
    const seen: [number, number][] = [];

    await runExport({
      files: [file("a"), file("b"), file("pic", { file_type: "image" })],
      drive: "d",
      providers: [],
      signal: new AbortController().signal,
      onProgress: (done, total) => seen.push([done, total]),
    });

    expect(seen).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ]);
  });

  it("hands on the providers' labels and preambles and the unregistered ids", async () => {
    const result = await runExport({
      files: [],
      drive: "d",
      providers: [{ ...provider("p", async () => ({ kind: "empty" })), preamble: "legend" }],
      unregistered: ["late"],
      signal: new AbortController().signal,
    });

    expect(result?.providers).toEqual([{ id: "p", label: "p", preamble: "legend" }]);
    expect(result?.unregistered).toEqual(["late"]);
  });
});
