import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { getAddonsStatus } = vi.hoisted(() => ({ getAddonsStatus: vi.fn() }));

vi.mock("@/lib/addons", () => ({ getAddonsStatus }));
vi.mock("@/components/CurrentDriveProvider", () => ({ useCurrentDrive: () => "d" }));

import { AddonSlotsProvider, useAddonSlots } from "../AddonSlotsProvider";

function Probe() {
  const { modulesPending } = useAddonSlots();
  return <span data-testid="pending">{String(modulesPending)}</span>;
}

const status = (names: string[]) => ({
  addons: Object.fromEntries(names.map((name) => [name, {}])),
  slots: {},
});

function mount() {
  return render(
    <AddonSlotsProvider>
      <Probe />
    </AddonSlotsProvider>,
  );
}

beforeEach(() => {
  getAddonsStatus.mockReset();
});

describe("AddonSlotsProvider modulesPending", () => {
  it("is pending until the catalogue has been fetched", async () => {
    getAddonsStatus.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByTestId("pending")).toHaveTextContent("true");
  });

  it("settles once every addon's slot module has loaded", async () => {
    getAddonsStatus.mockResolvedValue(status(["cloud-sync"]));
    mount();
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("false"));
  });

  it("settles when a module fails to load, rather than waiting for ever", async () => {
    getAddonsStatus.mockResolvedValue(status(["cloud-sync", "no-such-addon"]));
    mount();
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("false"));
  });

  it("settles at once when no addon is active", async () => {
    getAddonsStatus.mockResolvedValue(status([]));
    mount();
    await waitFor(() => expect(screen.getByTestId("pending")).toHaveTextContent("false"));
  });
});
