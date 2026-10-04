import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import LoftPlayer from "../LoftPlayer";
import { registerLoftPlayer, _resetPlayerRegistryForTests } from "../playerRegistry";
import type { LoftEmbedProps } from "../types";

const slots = vi.hoisted(() => ({ modulesPending: false }));
vi.mock("@/components/AddonSlotsProvider", () => ({
  useAddonSlots: () => ({ modulesPending: slots.modulesPending }),
}));

const recorded: LoftEmbedProps[] = [];

function ProbeEmbed(props: LoftEmbedProps) {
  recorded.push(props);
  return <div data-testid="probe-embed" />;
}

beforeEach(() => {
  slots.modulesPending = false;
  recorded.length = 0;
  _resetPlayerRegistryForTests();
  registerLoftPlayer("youtube", ProbeEmbed);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({ provider: "youtube", url: "https://youtu.be/abcdefghijk" }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoftPlayer", () => {
  it("resolves the embed for the .loft provider", async () => {
    render(<LoftPlayer fileId="abc123456789" />);
    expect(await screen.findByTestId("probe-embed")).toBeInTheDocument();
  });

  it("passes durationHint through to the embed", async () => {
    render(<LoftPlayer fileId="abc123456789" durationHint={612} />);
    await screen.findByTestId("probe-embed");
    await waitFor(() => expect(recorded.at(-1)?.durationHint).toBe(612));
  });

  it("passes a null durationHint through unchanged", async () => {
    // A .loft whose metadata never yielded a duration must reach the
    // embed as null so ad detection can disable itself, rather than
    // being silently coerced to a number.
    render(<LoftPlayer fileId="abc123456789" durationHint={null} />);
    await screen.findByTestId("probe-embed");
    await waitFor(() => expect(recorded.at(-1)?.durationHint).toBeNull());
  });

  it("still forwards initialTime alongside the hint", async () => {
    render(<LoftPlayer fileId="abc123456789" durationHint={612} initialTime={90} />);
    await screen.findByTestId("probe-embed");
    await waitFor(() => expect(recorded.at(-1)?.initialTime).toBe(90));
  });

  it("hands the file's poster to the embed, so a blank frame can be covered", async () => {
    render(<LoftPlayer fileId="abc123456789" posterUrl="/thumb.jpg" />);
    await screen.findByTestId("probe-embed");
    expect(recorded.at(-1)?.posterUrl).toBe("/thumb.jpg");
  });

  it("hands no poster for a file that has none", async () => {
    render(<LoftPlayer fileId="abc123456789" />);
    await screen.findByTestId("probe-embed");
    expect(recorded.at(-1)?.posterUrl).toBeUndefined();
  });

  it("shows the player that registers after the .loft was read, in place of the link", async () => {
    _resetPlayerRegistryForTests();
    render(<LoftPlayer fileId="abc123456789" />);
    expect(await screen.findByRole("link")).toBeInTheDocument();

    act(() => registerLoftPlayer("youtube", ProbeEmbed));

    expect(await screen.findByTestId("probe-embed")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("holds the box, not the link, while addon modules are still loading", async () => {
    _resetPlayerRegistryForTests();
    slots.modulesPending = true;
    const { rerender } = render(<LoftPlayer fileId="abc123456789" posterUrl="/thumb.jpg" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => {});

    expect(screen.getByTestId("loft-loading").style.backgroundImage).toContain("/thumb.jpg");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    slots.modulesPending = false;
    rerender(<LoftPlayer fileId="abc123456789" posterUrl="/thumb.jpg" />);
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("draws a registered player at once even while addon modules are loading", async () => {
    slots.modulesPending = true;
    render(<LoftPlayer fileId="abc123456789" />);
    expect(await screen.findByTestId("probe-embed")).toBeInTheDocument();
  });

  it("while the .loft is read, holds a 16:9 box showing the poster", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<LoftPlayer fileId="abc123456789" posterUrl="/thumb.jpg" />);
    const box = screen.getByTestId("loft-loading");
    expect(box).toHaveClass("aspect-video");
    expect(box.style.backgroundImage).toContain("/thumb.jpg");
    expect(box.querySelector(".animate-spin")).toBeNull();
  });

  it("holds the same box without a poster", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(<LoftPlayer fileId="abc123456789" />);
    const box = screen.getByTestId("loft-loading");
    expect(box).toHaveClass("aspect-video");
    expect(box.style.backgroundImage).toBe("");
  });
});
