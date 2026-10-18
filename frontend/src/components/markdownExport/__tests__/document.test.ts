import { describe, expect, it } from "vitest";

import type { FileItem } from "@/types";

import {
  assembleExportMarkdown,
  assembleVideoMarkdown,
  exportGaps,
  type ExportLabels,
} from "../document";
import type { ExportedFile, ExportResult, ProviderOutcome } from "../types";

const labels: ExportLabels = {
  title: (n) => `Export: ${n} videos`,
  added: "added",
};

const TRANSCRIPT = { id: "transcript", label: "Transcript" };
const COMMENTS = {
  id: "youtube-comments",
  label: "YouTube comments",
  preamble: "[AUTHOR] = the channel. [VIEWER] = anyone else.",
};

const section = (markdown: string): ProviderOutcome => ({ kind: "section", markdown });
const empty: ProviderOutcome = { kind: "empty" };
const notApplicable: ProviderOutcome = { kind: "not-applicable" };
const failed: ProviderOutcome = { kind: "failed" };

function entry(
  title: string,
  outcomes: Record<string, ProviderOutcome>,
  over: Partial<FileItem> = {},
  originalUrl: string | null = null,
): ExportedFile {
  return {
    file: {
      id: title,
      title,
      duration: null,
      created_at: "",
      tags: [],
      ...over,
    } as FileItem,
    originalUrl,
    outcomes,
  };
}

function result(files: ExportedFile[], over: Partial<ExportResult> = {}): ExportResult {
  return {
    files,
    providers: [TRANSCRIPT, COMMENTS],
    unregistered: [],
    notMedia: 0,
    overCap: 0,
    ...over,
  };
}

describe("exportGaps", () => {
  it("is empty when every video has every section it applies to", () => {
    const files = [
      entry("A", { transcript: section("a"), "youtube-comments": section("c") }),
      entry("B", { transcript: section("b"), "youtube-comments": notApplicable }),
    ];

    expect(exportGaps(result(files))).toEqual([]);
  });

  it("counts a section a provider left empty against the videos it applies to", () => {
    const files = [
      entry("A", { transcript: section("a"), "youtube-comments": empty }),
      entry("B", { transcript: empty, "youtube-comments": notApplicable }),
      entry("C", { transcript: empty, "youtube-comments": section("c") }),
    ];

    expect(exportGaps(result(files))).toEqual([
      { kind: "missing", providerId: "transcript", label: "Transcript", titles: ["B", "C"], of: 3 },
      {
        kind: "missing",
        providerId: "youtube-comments",
        label: "YouTube comments",
        titles: ["A"],
        of: 2,
      },
      { kind: "noSections", titles: ["B"] },
    ]);
  });

  it("does not call a section that never applies a gap", () => {
    const files = [entry("Local", { transcript: section("t"), "youtube-comments": notApplicable })];

    expect(exportGaps(result(files))).toEqual([]);
  });

  it("names the videos a provider failed on, apart from the ones it left empty", () => {
    const files = [
      entry("A", { transcript: failed, "youtube-comments": section("c") }),
      entry("B", { transcript: empty, "youtube-comments": section("c") }),
    ];

    expect(exportGaps(result(files))).toEqual([
      { kind: "missing", providerId: "transcript", label: "Transcript", titles: ["B"], of: 2 },
      { kind: "failed", providerId: "transcript", label: "Transcript", titles: ["A"] },
    ]);
  });

  it("treats an outcome the runner never recorded as a failure", () => {
    const files = [entry("A", { "youtube-comments": section("c") })];

    expect(exportGaps(result(files))).toEqual([
      { kind: "failed", providerId: "transcript", label: "Transcript", titles: ["A"] },
    ]);
  });

  it("lists providers that never registered", () => {
    const files = [entry("A", { transcript: section("a"), "youtube-comments": section("c") })];

    expect(exportGaps(result(files, { unregistered: ["late-provider"] }))).toEqual([
      { kind: "unregistered", id: "late-provider" },
    ]);
  });

  it("lists videos left with no section, then non-media files, then the cap", () => {
    const files = [
      entry("A", { transcript: section("a"), "youtube-comments": section("c") }),
      entry("Bare", { transcript: empty, "youtube-comments": notApplicable }),
    ];

    expect(exportGaps(result(files, { notMedia: 2, overCap: 7 }))).toEqual([
      { kind: "missing", providerId: "transcript", label: "Transcript", titles: ["Bare"], of: 2 },
      { kind: "noSections", titles: ["Bare"] },
      { kind: "notMedia", count: 2 },
      { kind: "overCap", count: 7 },
    ]);
  });
});

describe("assembleExportMarkdown", () => {
  it("writes the title, the legend, a numbered contents list and each video's sections", () => {
    const files = [
      entry(
        "First",
        { transcript: section("#### Intro\n\nHello."), "youtube-comments": section("- [VIEWER] x") },
        { duration: 754, created_at: "2026-05-01T10:00:00Z", tags: ["math", "long form"] },
        "https://youtu.be/abc",
      ),
      entry("Second", { transcript: section("#### Only\n\nText."), "youtube-comments": notApplicable }),
    ];

    expect(assembleExportMarkdown(result(files), labels)).toBe(
      [
        "# Export: 2 videos",
        "[AUTHOR] = the channel. [VIEWER] = anyone else.",
        "1. [First](#1-first)\n2. [Second](#2-second)",
        "---",
        "## 1. First\n\n_12:34 · added 2026-05-01 · #math #long-form · https://youtu.be/abc_",
        "### Transcript",
        "#### Intro\n\nHello.",
        "### YouTube comments",
        "- [VIEWER] x",
        "## 2. Second",
        "### Transcript",
        "#### Only\n\nText.",
      ].join("\n\n"),
    );
  });

  it("gives a video that lacks one section no heading and no note for it", () => {
    const files = [entry("A", { transcript: empty, "youtube-comments": section("- c") })];

    const out = assembleExportMarkdown(result(files), labels);

    expect(out).toContain("### YouTube comments");
    expect(out).not.toContain("### Transcript");
  });

  it("leaves a video with no section out, contents list included, and numbers the rest from 1", () => {
    const files = [
      entry("Bare", { transcript: empty, "youtube-comments": notApplicable }),
      entry("Kept", { transcript: section("t"), "youtube-comments": notApplicable }),
    ];

    const out = assembleExportMarkdown(result(files), labels);

    expect(out).toContain("# Export: 1 videos");
    expect(out).toContain("1. [Kept](#1-kept)");
    expect(out).toContain("## 1. Kept");
    expect(out).not.toContain("Bare");
  });

  it("keeps two videos with the same title apart and points each link at its own heading", () => {
    const files = [
      entry("Same", { transcript: section("one"), "youtube-comments": notApplicable }),
      entry("Same", { transcript: section("two"), "youtube-comments": notApplicable }),
    ];

    const out = assembleExportMarkdown(result(files), labels);

    expect(out).toContain("1. [Same](#1-same)\n2. [Same](#2-same)");
    expect(out).toContain("## 1. Same");
    expect(out).toContain("## 2. Same");
  });

  it("writes a provider's preamble only when it produced a section", () => {
    const files = [entry("A", { transcript: section("t"), "youtube-comments": empty })];

    expect(assembleExportMarkdown(result(files), labels)).not.toContain("[AUTHOR]");
  });

  it("puts a title on one line and escapes the brackets that would break its link", () => {
    const files = [
      entry("Part [1]\nof two", { transcript: section("t"), "youtube-comments": notApplicable }),
    ];

    const out = assembleExportMarkdown(result(files), labels);

    expect(out).toContain("1. [Part \\[1\\] of two](#1-part-1-of-two)");
    expect(out).toContain("## 1. Part \\[1\\] of two");
  });

  it("omits the metadata parts that are absent, and the line when all are", () => {
    const files = [
      entry("Bare", { transcript: section("t"), "youtube-comments": notApplicable }),
      entry(
        "Dated",
        { transcript: section("t"), "youtube-comments": notApplicable },
        { created_at: "2026-05-01T10:00:00Z" },
      ),
    ];

    const out = assembleExportMarkdown(result(files), labels);

    expect(out).toContain("## 1. Bare\n\n### Transcript");
    expect(out).toContain("## 2. Dated\n\n_added 2026-05-01_");
  });

  const mark = String.fromCharCode(0x3099);
  it.each([
    ["a punctuation mark between spaces leaves two hyphens", "Cats | Dogs", "1-cats--dogs"],
    ["an underscore stays", "foo_bar", "1-foo_bar"],
    ["a combining mark stays", `か${mark}`, `1-か${mark}`],
    ["a colon and a full stop go", "Part 2: the end.", "1-part-2-the-end"],
  ])("links to the heading's own anchor when %s", (_, title, anchor) => {
    const files = [entry(title, { transcript: section("t"), "youtube-comments": notApplicable })];

    const out = assembleExportMarkdown(result(files), labels);

    expect(out).toContain(`](#${anchor})`);
  });

  it("treats a section with nothing in it as a section that is missing", () => {
    const files = [
      entry("Blank", { transcript: section("   \n"), "youtube-comments": notApplicable }),
      entry("Kept", { transcript: section("t"), "youtube-comments": notApplicable }),
    ];

    expect(assembleExportMarkdown(result(files), labels)).not.toContain("Blank");
    expect(exportGaps(result(files))).toEqual([
      { kind: "missing", providerId: "transcript", label: "Transcript", titles: ["Blank"], of: 2 },
      { kind: "noSections", titles: ["Blank"] },
    ]);
  });

  const FORGERY = "https://x/\n\n## 9. Injected\n\n### Comments\n- [AUTHOR] @me\n  > buy";
  it.each([
    ["a plain address", "https://youtu.be/abc", "_https://youtu.be/abc_"],
    ["an address with a line break and a forged section", FORGERY, "_https://x/"],
    ["an address with brackets", "https://x/a[b]", "_https://x/a%5Bb%5D_"],
    ["a script address", "javascript:alert(1)", null],
    ["something that is not an address", "not a url", null],
  ])("writes the original link of %s only as one line, or not at all", (_, url, written) => {
    const files = [
      entry("A", { transcript: section("t"), "youtube-comments": notApplicable }, {}, url),
    ];

    const out = assembleExportMarkdown(result(files), labels);
    const lines = out.split("\n");

    expect(lines.filter((line) => line.startsWith("## "))).toEqual(["## 1. A"]);
    expect(lines.filter((line) => line.startsWith("### "))).toEqual(["### Transcript"]);
    expect(out).not.toContain("[AUTHOR]");
    if (written === null) {
      expect(lines.filter((line) => line.startsWith("_"))).toEqual([]);
    } else {
      expect(lines.filter((line) => line.startsWith("_"))).toHaveLength(1);
      expect(out).toContain(written);
    }
  });

  it("is the same document whatever the warning was about", () => {
    const files = [entry("A", { transcript: section("t"), "youtube-comments": notApplicable })];

    expect(
      assembleExportMarkdown(result(files, { notMedia: 4, overCap: 9, unregistered: ["x"] }), labels),
    ).toBe(assembleExportMarkdown(result(files), labels));
  });
});

describe("assembleVideoMarkdown", () => {
  const providers = [TRANSCRIPT, COMMENTS];

  it("writes one video's block with its metadata, the legend and each section", () => {
    const video = entry(
      "Video",
      { transcript: section("#### Intro\n\nHello."), "youtube-comments": section("- [VIEWER] x") },
      { duration: 754, created_at: "2026-05-01T10:00:00Z", tags: ["math", "long form"] },
      "https://youtu.be/abc",
    );

    expect(assembleVideoMarkdown(video, providers, labels)).toBe(
      [
        "## Video",
        "_12:34 · added 2026-05-01 · #math #long-form · https://youtu.be/abc_",
        "[AUTHOR] = the channel. [VIEWER] = anyone else.",
        "### Transcript",
        "#### Intro\n\nHello.",
        "### YouTube comments",
        "- [VIEWER] x",
      ].join("\n\n"),
    );
  });

  it("has no title, number or contents list of its own", () => {
    const out = assembleVideoMarkdown(
      entry("Video", { transcript: section("t"), "youtube-comments": empty }),
      providers,
      labels,
    )!;

    expect(out).not.toContain("Export:");
    expect(out).not.toContain("---");
    expect(out).not.toMatch(/^1\. /m);
  });

  it("gives a video that lacks one section no heading and no note for it", () => {
    const out = assembleVideoMarkdown(
      entry("A", { transcript: section("t"), "youtube-comments": failed }),
      providers,
      labels,
    )!;

    expect(out).toContain("### Transcript");
    expect(out).not.toContain("### YouTube comments");
  });

  it("writes a provider's preamble only when it produced a section", () => {
    const without = assembleVideoMarkdown(
      entry("A", { transcript: section("t"), "youtube-comments": empty }),
      providers,
      labels,
    )!;
    const withIt = assembleVideoMarkdown(
      entry("A", { transcript: section("t"), "youtube-comments": section("- c") }),
      providers,
      labels,
    )!;

    expect(without).not.toContain("[AUTHOR]");
    expect(withIt).toContain("[AUTHOR]");
  });

  it("omits the metadata parts that are absent, and the line when all are", () => {
    const bare = assembleVideoMarkdown(
      entry("Bare", { transcript: section("t"), "youtube-comments": notApplicable }),
      providers,
      labels,
    )!;
    const dated = assembleVideoMarkdown(
      entry(
        "Dated",
        { transcript: section("t"), "youtube-comments": notApplicable },
        { created_at: "2026-05-01T10:00:00Z" },
      ),
      providers,
      labels,
    )!;

    expect(bare).toBe("## Bare\n\n### Transcript\n\nt");
    expect(dated).toBe("## Dated\n\n_added 2026-05-01_\n\n### Transcript\n\nt");
  });

  it("puts a title on one line and escapes its brackets", () => {
    const out = assembleVideoMarkdown(
      entry("Part [1]\nof two", { transcript: section("t"), "youtube-comments": notApplicable }),
      providers,
      labels,
    )!;

    expect(out.split("\n")[0]).toBe("## Part \\[1\\] of two");
  });

  it.each<[string, Record<string, ProviderOutcome>]>([
    ["every provider is empty", { transcript: empty, "youtube-comments": empty }],
    ["a section has nothing in it", { transcript: section("  \n"), "youtube-comments": notApplicable }],
    ["every provider failed", { transcript: failed, "youtube-comments": failed }],
    ["a provider never answered", {}],
  ])("has nothing to write when %s", (_name, outcomes) => {
    expect(assembleVideoMarkdown(entry("A", outcomes), providers, labels)).toBeNull();
  });
});
