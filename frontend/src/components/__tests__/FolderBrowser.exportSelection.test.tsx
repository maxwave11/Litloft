/**
 * What the selection bar is handed to export: the selected files, in the order
 * the list draws them, on every list the browser can show.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FolderBrowser } from "../FolderBrowser";

vi.mock("@/components/folder/FolderContent", () => ({
  FolderContent: ({
    files,
    onSelect,
  }: {
    files: { id: string }[];
    onSelect: (id: string) => void;
  }) => (
    <div>
      {files.map((f) => (
        <button key={f.id} onClick={() => onSelect(f.id)}>
          pick {f.id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("@/components/folder/FolderToolbar", () => ({
  FolderToolbar: ({ onToggleSelectable }: { onToggleSelectable: () => void }) => (
    <button onClick={onToggleSelectable}>enter selection</button>
  ),
}));
vi.mock("@/components/SelectionBar", () => ({
  SelectionBar: ({ selectedFiles }: { selectedFiles?: { id: string }[] }) => (
    <div data-testid="selection-bar">{selectedFiles?.map((f) => f.id).join(",")}</div>
  ),
}));
vi.mock("@/components/Breadcrumb", () => ({ Breadcrumb: () => <nav /> }));
vi.mock("@/components/TreeToggle", () => ({ TreeToggle: () => null }));
vi.mock("@/components/SmartFolderSaveButton", () => ({ SmartFolderSaveButton: () => null }));
vi.mock("@/components/AddonSlot", () => ({ AddonSlot: () => null }));
vi.mock("@/components/UploadZone", () => ({
  UploadZone: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/AddButton", () => ({ AddButton: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/ClipboardProvider", () => ({
  useClipboard: () => ({
    clipboard: null,
    paste: vi.fn(),
    clear: vi.fn(),
    copy: vi.fn(),
    cut: vi.fn(),
    isCut: () => false,
  }),
}));
vi.mock("@/components/TreeRefreshContext", () => ({ useTreeRefresh: () => vi.fn() }));
vi.mock("@/hooks/useShortcuts", () => ({ useShortcuts: vi.fn() }));
vi.mock("@/hooks/useSelectedFile", () => ({ useSelectedFile: () => ({ fileId: null }) }));
vi.mock("@/hooks/useTreeEnabled", () => ({ useTreeEnabled: () => ({ enabled: false }) }));
vi.mock("@/lib/scrollContainer", () => ({ useScrollContainer: () => null }));
vi.mock("@/lib/listSnapshot", () => ({
  buildListSnapshotKey: () => "key",
  clearListSnapshot: vi.fn(),
  loadListSnapshot: () => null,
  saveListSnapshot: vi.fn(),
}));
vi.mock("@/components/folder/usePinnedFolders", () => ({
  usePinnedFolders: () => ({ pinnedPaths: new Set<string>(), handleTogglePin: vi.fn() }),
}));
vi.mock("@/components/folder/useDriveScan", () => ({
  useDriveScan: () => ({ scanning: false, handleScan: vi.fn() }),
}));
vi.mock("@/components/folder/useCreateFolder", () => ({
  useCreateFolder: () => ({
    creatingFolder: false,
    newFolderName: "",
    folderError: null,
    setCreatingFolder: vi.fn(),
    setNewFolderName: vi.fn(),
    setFolderError: vi.fn(),
    handleCreateFolder: vi.fn(),
  }),
}));
vi.mock("@/hooks/useCreateFile", () => ({
  useCreateFile: () => ({ createFile: vi.fn(), isCreating: false }),
}));
vi.mock("@/components/folder/useFolderFiles", () => ({
  useFolderFiles: () => ({
    files: ["c", "a", "b"].map((id) => ({ id, filename: `${id}.mp4`, file_type: "video" })),
    folders: [],
    total: 3,
    loading: false,
    loadingMore: false,
    hasMore: false,
    pagesLoaded: 1,
    sentinelRef: { current: null },
    reset: vi.fn(),
    setFiles: vi.fn(),
    setPaginatedTotal: vi.fn(),
    setFolders: vi.fn(),
    isRecent: false,
    hasProfile: false,
    snapshotKey: "key",
    hydratedScrollY: null,
  }),
}));
vi.mock("@/hooks/useFolderViewMode", () => ({
  useFolderSort: () => ({ sort: "title" as const, order: "asc" as const, setSort: vi.fn() }),
  useFolderViewMode: () => ({ viewMode: "list" as const, setViewMode: vi.fn() }),
}));

const SCREENS: ReadonlyArray<[string, Parameters<typeof FolderBrowser>[0]]> = [
  ["a folder", { driveName: "main", folderPath: "recipes" }],
  ["Favourites", { driveName: "main", view: "favorites" }],
  ["a tag at the drive root", { driveName: "main", tagFilter: "soup" }],
  ["search results", { driveName: "main", searchQuery: "cake" }],
];

describe("the files handed to the selection bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it.each(SCREENS)("are the selected ones in list order on %s", (_, props) => {
    render(<FolderBrowser {...props} />);
    fireEvent.click(screen.getByText("enter selection"));

    fireEvent.click(screen.getByText("pick b"));
    fireEvent.click(screen.getByText("pick c"));

    expect(screen.getByTestId("selection-bar")).toHaveTextContent("c,b");

    fireEvent.click(screen.getByText("pick a"));

    expect(screen.getByTestId("selection-bar")).toHaveTextContent("c,a,b");
  });
});
