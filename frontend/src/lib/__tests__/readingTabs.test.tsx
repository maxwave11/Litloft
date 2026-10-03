import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MessagesSquare, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import {
  resetReadingTabs,
  useHasReadingTabHost,
  useOfferReadingTab,
  useReadingTabHost,
  useReadingTabs,
  type ReadingTab,
} from "../readingTabs";

function tab(id: string, over: Partial<ReadingTab> = {}): ReadingTab {
  return { id, label: id, icon: Sparkles, order: 10, panel: null, ...over };
}

interface OfferProps {
  fileId: string;
  tab: ReadingTab | null;
}

function offer(initial: OfferProps) {
  return renderHook(
    (props: OfferProps) => useOfferReadingTab(props.fileId, props.tab),
    { initialProps: initial },
  );
}

function tabsOf(fileId: string) {
  const { result } = renderHook(() => useReadingTabs(fileId));
  return () => result.current;
}

const ids = (read: () => readonly ReadingTab[]) => read().map((t) => t.id);

afterEach(() => {
  act(() => resetReadingTabs());
});

describe("offered tabs", () => {
  it("lists offers by ascending order, then by id", () => {
    offer({ fileId: "f1", tab: tab("b.late", { order: 100 }) });
    offer({ fileId: "f1", tab: tab("z.first", { order: 10 }) });
    offer({ fileId: "f1", tab: tab("a.late", { order: 100 }) });

    expect(ids(tabsOf("f1"))).toEqual(["z.first", "a.late", "b.late"]);
  });

  it("keeps each file's offers to that file", () => {
    offer({ fileId: "f1", tab: tab("one") });
    offer({ fileId: "f2", tab: tab("two") });

    expect(ids(tabsOf("f1"))).toEqual(["one"]);
    expect(ids(tabsOf("f2"))).toEqual(["two"]);
    expect(ids(tabsOf("f3"))).toEqual([]);
  });

  it.each(["first", "second"] as const)(
    "keeps an offer listed when the %s of two mounts unmounts",
    (which) => {
      const first = offer({ fileId: "f1", tab: tab("same") });
      const second = offer({ fileId: "f1", tab: tab("same") });
      const read = tabsOf("f1");

      (which === "first" ? first : second).unmount();

      expect(ids(read)).toEqual(["same"]);
    },
  );

  it("withdraws the offer when its offerer unmounts", () => {
    const mounted = offer({ fileId: "f1", tab: tab("one") });
    const read = tabsOf("f1");

    mounted.unmount();

    expect(ids(read)).toEqual([]);
  });

  it("withdraws on null and offers again when a tab comes back", () => {
    const mounted = offer({ fileId: "f1", tab: tab("one") });
    const read = tabsOf("f1");

    mounted.rerender({ fileId: "f1", tab: null });
    expect(ids(read)).toEqual([]);
    mounted.rerender({ fileId: "f1", tab: tab("one") });
    expect(ids(read)).toEqual(["one"]);
  });

  it("replaces an offer's label and panel when the offerer re-renders with new ones", () => {
    const first: ReactNode = "first panel";
    const second: ReactNode = "second panel";
    const mounted = offer({ fileId: "f1", tab: tab("one", { label: "One", panel: first }) });
    const read = tabsOf("f1");

    mounted.rerender({ fileId: "f1", tab: tab("one", { label: "One (3)", panel: second }) });

    expect(read().map((t) => [t.label, t.panel])).toEqual([["One (3)", "second panel"]]);
  });

  it("moves an offer to the file its offerer is re-rendered with", () => {
    const mounted = offer({ fileId: "f1", tab: tab("one") });
    const readF1 = tabsOf("f1");
    const readF2 = tabsOf("f2");

    mounted.rerender({ fileId: "f2", tab: tab("one") });

    expect(ids(readF1)).toEqual([]);
    expect(ids(readF2)).toEqual(["one"]);
  });

  it("carries the icon the offerer gave", () => {
    offer({ fileId: "f1", tab: tab("one", { icon: MessagesSquare }) });

    expect(tabsOf("f1")()[0].icon).toBe(MessagesSquare);
  });
});

describe("the tab host", () => {
  function host(fileId: string) {
    return renderHook((id: string) => useReadingTabHost(id), { initialProps: fileId });
  }

  function hosted(fileId: string) {
    const { result } = renderHook(() => useHasReadingTabHost(fileId));
    return () => result.current;
  }

  it("is absent until something hosts the file's tabs", () => {
    expect(hosted("f1")()).toBe(false);
  });

  it("is present while mounted, for its own file only", () => {
    host("f1");

    expect(hosted("f1")()).toBe(true);
    expect(hosted("f2")()).toBe(false);
  });

  it("is gone once the host unmounts", () => {
    const mounted = host("f1");
    const read = hosted("f1");

    mounted.unmount();

    expect(read()).toBe(false);
  });

  it("stays present while one of two hosts is left", () => {
    const first = host("f1");
    host("f1");
    const read = hosted("f1");

    first.unmount();

    expect(read()).toBe(true);
  });

  it("follows a host that is re-rendered with another file", () => {
    const mounted = host("f1");
    const readF1 = hosted("f1");
    const readF2 = hosted("f2");

    mounted.rerender("f2");

    expect([readF1(), readF2()]).toEqual([false, true]);
  });
});
