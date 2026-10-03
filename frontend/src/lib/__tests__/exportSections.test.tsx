import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";

import {
  resetExportSections,
  useExportSections,
  useOfferExportSection,
  type ExportSectionProvider,
} from "../exportSections";

function provider(
  id: string,
  over: Partial<ExportSectionProvider> = {},
): ExportSectionProvider {
  return {
    id,
    label: id,
    order: 10,
    build: async () => ({ kind: "empty" }),
    ...over,
  };
}

function offer(initial: ExportSectionProvider | null) {
  return renderHook(
    (props: { provider: ExportSectionProvider | null }) =>
      useOfferExportSection(props.provider),
    { initialProps: { provider: initial } },
  );
}

function listed() {
  const { result } = renderHook(() => useExportSections());
  return () => result.current.map((p) => p.id);
}

afterEach(() => {
  act(() => resetExportSections());
});

describe("offered export sections", () => {
  it("lists providers by ascending order, then by id", () => {
    offer(provider("b.late", { order: 100 }));
    offer(provider("z.first", { order: 10 }));
    offer(provider("a.late", { order: 100 }));

    expect(listed()()).toEqual(["z.first", "a.late", "b.late"]);
  });

  it("lists a provider only while its component is mounted", () => {
    const read = listed();
    const mount = offer(provider("transcript"));
    expect(read()).toEqual(["transcript"]);

    mount.unmount();

    expect(read()).toEqual([]);
  });

  it.each(["first", "second"] as const)(
    "keeps a provider listed once when the %s of two mounts unmounts",
    (which) => {
      const first = offer(provider("same"));
      const second = offer(provider("same"));
      const read = listed();
      expect(read()).toEqual(["same"]);

      (which === "first" ? first : second).unmount();

      expect(read()).toEqual(["same"]);
    },
  );

  it("withdraws a provider when the offer becomes null", () => {
    const mount = offer(provider("transcript"));
    const read = listed();

    mount.rerender({ provider: null });

    expect(read()).toEqual([]);
  });
});
