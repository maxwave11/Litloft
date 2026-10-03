import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createFileMetadataStore } from "../fileMetadataStore";

vi.mock("@/hooks/useWebSocket", () => ({ useWebSocket: () => null }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("batches subscribers, shares duplicate requests, and isolates identical IDs by drive", async () => {
  vi.useFakeTimers();
  const load = vi.fn(async (drive: string, ids: string[]) =>
    Object.fromEntries(ids.map(id => [id, `${drive}:${id}`])),
  );
  const useMetadata = createFileMetadataStore(load);
  function Card({ drive, id }: { drive: string; id: string }) {
    return <span>{useMetadata(id, drive) ?? "loading"}</span>;
  }
  render(<><Card drive="one" id="same" /><Card drive="one" id="same" /><Card drive="one" id="second" /><Card drive="two" id="same" /></>);
  await act(async () => { await vi.advanceTimersByTimeAsync(40); });
  expect(load).toHaveBeenCalledTimes(2);
  expect(load).toHaveBeenCalledWith("one", ["same", "second"]);
  expect(load).toHaveBeenCalledWith("two", ["same"]);
  expect(screen.getAllByText("one:same")).toHaveLength(2);
  expect(screen.getByText("two:same")).toBeInTheDocument();
});

it("refreshes on focus, retains the last snapshot during an outage, and stops polling after unmount", async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockResolvedValueOnce({ video: "working" }).mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ video: "ready" });
  const useMetadata = createFileMetadataStore<string>(load);
  function Card() { return <span>{useMetadata("video", "drive") ?? "loading"}</span>; }
  const view = render(<Card />);
  await act(async () => { await vi.advanceTimersByTimeAsync(40); });
  expect(screen.getByText("working")).toBeInTheDocument();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(40);
  });
  expect(screen.getByText("working")).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(screen.getByText("ready")).toBeInTheDocument();
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(load).toHaveBeenCalledTimes(3);
});
