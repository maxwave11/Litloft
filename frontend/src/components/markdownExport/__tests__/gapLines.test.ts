import { describe, expect, it } from "vitest";

import type { Gap } from "../document";
import { gapLines } from "../gapLines";
import { MAX_EXPORT_FILES } from "../runExport";
import type { ExportResult } from "../types";

const t = (key: string, values: Record<string, string | number> = {}) =>
  `${key}${Object.entries(values)
    .map(([k, v]) => ` ${k}=${v}`)
    .join("")}`;

function result(over: Partial<ExportResult> = {}): ExportResult {
  return {
    files: [],
    providers: [{ id: "p", label: "P" }],
    unregistered: [],
    notMedia: 0,
    overCap: 0,
    ...over,
  };
}

describe("gapLines", () => {
  it("says nothing can provide content when no provider is there and none is missing", () => {
    expect(gapLines([], result({ providers: [] }), t)).toEqual(["gapNoProviders"]);
  });

  it("does not say it when a provider is there, or one that never showed up is named", () => {
    expect(gapLines([], result(), t)).toEqual([]);
    expect(
      gapLines(
        [{ kind: "unregistered", id: "Ghost" }],
        result({ providers: [], unregistered: ["Ghost"] }),
        t,
      ),
    ).toEqual(["gapUnavailable name=Ghost"]);
  });

  it("writes one line per gap, in the order the gaps come", () => {
    const gaps: Gap[] = [
      { kind: "missing", providerId: "p", label: "P", titles: ["A", "B"], of: 5 },
      { kind: "failed", providerId: "p", label: "P", titles: ["C"] },
      { kind: "noSections", titles: ["D"] },
      { kind: "notMedia", count: 2 },
      { kind: "overCap", count: 7 },
    ];

    expect(gapLines(gaps, result(), t)).toEqual([
      "gapMissing label=P count=2 total=5 titles=A, B",
      "gapFailed label=P titles=C",
      "gapNoSections titles=D",
      "gapNotMedia count=2",
      `gapOverCap max=${MAX_EXPORT_FILES} count=7`,
    ]);
  });

  it("names five titles and counts the rest", () => {
    const titles = ["1", "2", "3", "4", "5", "6", "7"];

    expect(
      gapLines([{ kind: "noSections", titles }], result(), t),
    ).toEqual(["gapNoSections titles=1, 2, 3, 4, 5 andMore count=2"]);
  });
});
