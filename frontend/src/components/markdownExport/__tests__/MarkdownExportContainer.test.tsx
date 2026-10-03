import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ShortcutsProvider } from "@/components/ShortcutsProvider";
import { useShortcuts } from "@/hooks/useShortcuts";
import { resetExportSections, type ExportSectionProvider } from "@/lib/exportSections";
import type { FileItem } from "@/types";

const hoisted = vi.hoisted(() => ({
  slot: {
    loading: false,
    expected: [] as { id: string; label: string }[],
    offering: [] as unknown[],
  },
  copyText: vi.fn(async (_text: string) => true),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/AddonSlotsProvider", () => ({
  useAddonSlots: () => ({
    loading: hoisted.slot.loading,
    getSlotEntries: () => hoisted.slot.expected,
  }),
}));

vi.mock("@/components/AddonSlot", async () => {
  const { useOfferExportSection } = await import("@/lib/exportSections");
  function Offer({ provider }: { provider: ExportSectionProvider }) {
    useOfferExportSection(provider);
    return null;
  }
  return {
    AddonSlot: () => (
      <>
        {(hoisted.slot.offering as ExportSectionProvider[]).map((p) => (
          <Offer key={p.id} provider={p} />
        ))}
      </>
    ),
  };
});

vi.mock("@/lib/copyText", () => ({ copyText: hoisted.copyText }));
vi.mock("@/components/ToastProvider", () => ({ useToast: () => hoisted.toast }));

import { MarkdownExportContainer } from "../MarkdownExportContainer";

function video(id: string, title: string): FileItem {
  return {
    id,
    filename: `${id}.mp4`,
    title,
    file_type: "video",
    duration: null,
    created_at: "",
    tags: [],
  } as unknown as FileItem;
}

function transcriptProvider(
  build: ExportSectionProvider["build"],
): ExportSectionProvider {
  return { id: "transcript", label: "Transcript", order: 10, build };
}

function offer(...providers: ExportSectionProvider[]) {
  hoisted.slot.expected = providers.map((p) => ({ id: p.id, label: p.label }));
  hoisted.slot.offering = providers;
}

const section = (markdown: string) => ({ kind: "section" as const, markdown });

function open(files: FileItem[], onClose = vi.fn()) {
  const ui = () => <MarkdownExportContainer files={files} drive="d" onClose={onClose} />;
  const view = render(ui());
  return { ...view, onClose, again: () => view.rerender(ui()) };
}

beforeEach(() => {
  hoisted.slot.loading = false;
  hoisted.slot.expected = [];
  hoisted.slot.offering = [];
  hoisted.copyText.mockClear();
  hoisted.copyText.mockResolvedValue(true);
  hoisted.toast.success.mockClear();
  hoisted.toast.error.mockClear();
});

afterEach(() => {
  cleanup();
  act(() => resetExportSections());
  vi.useRealTimers();
});

describe("MarkdownExportContainer", () => {
  it("shows the document at once when nothing is missing", async () => {
    offer(transcriptProvider(async (f) => section(`text of ${f.title}`)));

    open([video("a", "First"), video("b", "Second")]);

    expect(await screen.findByText("1. First")).toBeTruthy();
    expect(screen.getByText("2. Second")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("warns first when a video lacks a section, and Cancel closes without a document", async () => {
    offer(
      transcriptProvider(async (f) =>
        f.id === "b" ? { kind: "empty" } : section("t"),
      ),
    );

    const { onClose } = open([video("a", "First"), video("b", "Second")]);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Transcript: missing for 1 of 2 — Second");
    expect(screen.queryByText("1. First")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("1. First")).toBeNull();
  });

  it("shows the document, without the video that has nothing, after Continue", async () => {
    offer(
      transcriptProvider(async (f) =>
        f.id === "b" ? { kind: "empty" } : section("t"),
      ),
    );
    open([video("a", "First"), video("b", "Second")]);

    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));

    expect(screen.getByText("1. First")).toBeTruthy();
    expect(screen.queryByText(/Second/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("builds nothing until every entry the slot lists has offered a provider", async () => {
    const build = vi.fn(async () => section("t"));
    const late = transcriptProvider(build);
    hoisted.slot.expected = [{ id: "transcript", label: "Transcript" }];
    hoisted.slot.offering = [];
    const { again } = open([video("a", "First")]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(build).not.toHaveBeenCalled();

    hoisted.slot.offering = [late];
    again();

    await waitFor(() => expect(build).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("1. First")).toBeTruthy();
  });

  it("names, in the warning, an entry that never offered a provider", async () => {
    vi.useFakeTimers();
    hoisted.slot.expected = [{ id: "ghost", label: "Ghost provider" }];
    hoisted.slot.offering = [];
    open([video("a", "First")]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Not available: Ghost provider");
  });

  it("stops building when the dialog goes away", async () => {
    let signal: AbortSignal | undefined;
    offer(
      transcriptProvider((_file, _drive, s) => {
        signal = s;
        return new Promise(() => {});
      }),
    );

    const { unmount } = open([video("a", "First")]);
    await waitFor(() => expect(signal).toBeDefined());
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it("copies the whole document", async () => {
    offer(transcriptProvider(async (f) => section(`#### Intro\n\nsaid in ${f.title}`)));
    open([video("a", "First"), video("b", "Second")]);

    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));

    await waitFor(() => expect(hoisted.copyText).toHaveBeenCalledTimes(1));
    const copied = hoisted.copyText.mock.calls[0][0];
    expect(copied).toContain("## 1. First");
    expect(copied).toContain("said in First");
    expect(copied).toContain("## 2. Second");
    expect(copied).toContain("said in Second");
    await waitFor(() => expect(hoisted.toast.success).toHaveBeenCalledWith("Copied to the clipboard"));
  });

  it("says so when the copy fails", async () => {
    hoisted.copyText.mockResolvedValue(false);
    offer(transcriptProvider(async () => section("t")));
    open([video("a", "First")]);

    fireEvent.click(await screen.findByRole("button", { name: "Copy" }));

    await waitFor(() => expect(hoisted.toast.error).toHaveBeenCalledWith("Could not copy"));
    expect(hoisted.toast.success).not.toHaveBeenCalled();
  });

  it("draws a video's text only once it is opened", async () => {
    offer(transcriptProvider(async () => section("a long transcript")));
    open([video("a", "First")]);
    const heading = await screen.findByRole("button", { name: /1\. First/ });
    expect(screen.queryByText(/a long transcript/)).toBeNull();

    fireEvent.click(heading);
    expect(screen.getByText(/a long transcript/)).toBeTruthy();

    fireEvent.click(heading);
    expect(screen.queryByText(/a long transcript/)).toBeNull();
  });

  it("builds from the selection it was opened with", async () => {
    const build = vi.fn(async (f: FileItem) => section(f.title));
    offer(transcriptProvider(build));
    const files = [video("a", "First")];
    const { rerender } = render(
      <MarkdownExportContainer files={files} drive="d" onClose={() => {}} />,
    );
    await screen.findByText("1. First");

    rerender(
      <MarkdownExportContainer files={[video("a", "First"), video("b", "Other")]} drive="d" onClose={() => {}} />,
    );

    expect(screen.queryByText(/Other/)).toBeNull();
    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe("MarkdownExportContainer as a dialog", () => {
  it("is a named dialog that the close button dismisses", async () => {
    offer(transcriptProvider(async () => section("t")));
    const { onClose } = open([video("a", "First")]);
    await screen.findByText("1. First");

    expect(screen.getByRole("dialog", { name: "Export as Markdown" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers Copy only when there is a document to copy", async () => {
    offer(transcriptProvider(async () => ({ kind: "empty" })));
    open([video("a", "First")]);

    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByText("Nothing to export.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("warns that nothing can provide content when no provider is offered", async () => {
    hoisted.slot.expected = [];
    hoisted.slot.offering = [];
    open([video("a", "First")]);

    const alert = await screen.findByRole("alert");

    expect(alert.textContent).toContain("Nothing here can provide content for the export.");
  });

  it("does not take the providers there are before the slot catalogue has loaded", async () => {
    hoisted.slot.loading = true;
    const { again } = open([video("a", "First")]);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Preparing…");

    hoisted.slot.loading = false;
    again();

    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

describe("MarkdownExportContainer and the page's shortcuts", () => {
  function Page({ onCopy }: { onCopy: () => void }) {
    useShortcuts("page", "Page", [{ key: "ctrl+c", label: "Copy", handler: onCopy }]);
    return null;
  }

  function openOverPage(onClose = vi.fn()) {
    const onCopy = vi.fn();
    render(
      <ShortcutsProvider>
        <Page onCopy={onCopy} />
        <MarkdownExportContainer files={[video("a", "First")]} drive="d" onClose={onClose} />
      </ShortcutsProvider>,
    );
    return { onCopy, onClose };
  }

  it("closes on Escape", async () => {
    offer(transcriptProvider(async () => section("t")));
    const { onClose } = openOverPage();
    await screen.findByText("1. First");

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves the page's Ctrl+C alone, and the browser's own copy of selected text unprevented", async () => {
    offer(transcriptProvider(async () => section("t")));
    const { onCopy } = openOverPage();
    await screen.findByText("1. First");

    const notPrevented = fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });

    expect(onCopy).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });
});
