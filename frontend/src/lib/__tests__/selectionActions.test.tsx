import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Sparkles } from "lucide-react";

import {
  resetSelectionActions,
  useOfferSelectionAction,
  useSelectionActions,
  type SelectionAction,
} from "../selectionActions";

function action(id: string, order: number): SelectionAction {
  return { id, label: id, icon: Sparkles, order, run: () => {} };
}

function offer(initial: SelectionAction | null) {
  return renderHook(
    (value: SelectionAction | null) => useOfferSelectionAction(value),
    { initialProps: initial },
  );
}

function ids() {
  const { result } = renderHook(() => useSelectionActions());
  return () => result.current.map((a) => a.id);
}

afterEach(() => {
  act(() => resetSelectionActions());
});

describe("selection actions", () => {
  it("lists offers by order, then id, whatever order they mounted in", () => {
    const read = ids();
    offer(action("b", 20));
    offer(action("z", 10));
    offer(action("a", 20));
    expect(read()).toEqual(["z", "a", "b"]);
  });

  it("withdraws an offer when it becomes null or unmounts", () => {
    const read = ids();
    const first = offer(action("a", 10));
    const second = offer(action("b", 20));
    expect(read()).toEqual(["a", "b"]);
    first.rerender(null);
    expect(read()).toEqual(["b"]);
    second.unmount();
    expect(read()).toEqual([]);
  });

  it("keeps an offer that another mount of it also holds", () => {
    const read = ids();
    const first = offer(action("a", 10));
    offer(action("a", 10));
    first.unmount();
    expect(read()).toEqual(["a"]);
  });

  it("runs the latest closure without republishing the offer", () => {
    const calls: string[] = [];
    const { result } = renderHook(() => useSelectionActions());
    const hook = offer({ ...action("a", 10), run: () => calls.push("old") });
    const before = result.current;
    hook.rerender({ ...action("a", 10), run: () => calls.push("new") });
    expect(result.current).toBe(before);
    result.current[0].run();
    expect(calls).toEqual(["new"]);
  });

  it("republishes when the label or disabled flag changes", () => {
    const { result } = renderHook(() => useSelectionActions());
    const hook = offer(action("a", 10));
    hook.rerender({ ...action("a", 10), label: "changed", disabled: true });
    expect(result.current[0]).toMatchObject({ label: "changed", disabled: true });
  });
});
