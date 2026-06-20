# File Browser And Daily Transfer UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver Phase 1 of the optimization design: a Windows 11-style file browser, visible Shared Files and Received Files, in-app remote browsing, drag-and-drop sending, conflict-safe receiving, and completion notifications.

**Architecture:** Introduce a typed file-library boundary shared by the Electron main process, preload bridge, and React renderer. Keep filesystem and peer HTTP access in focused main-process modules; render all local and remote file sources through one reusable browser component. Preserve the current LAN protocol while replacing external-browser workarounds with typed IPC operations.

**Tech Stack:** Electron 34, React 19, TypeScript, electron-vite/Vite, Express, Vitest, React Testing Library, lucide-react.

---

## File Structure

Create these focused modules:

- `src/shared/fileBrowserTypes.ts`: serializable browser entry, location, view, and source contracts.
- `src/main/core/fileLibrary.ts`: safe local directory listing and metadata mapping.
- `src/main/core/receivedFiles.ts`: conflict-safe receive paths and received-file actions.
- `src/main/core/peerSharedClient.ts`: authenticated remote listing and download requests.
- `src/renderer/src/components/AppNavigation.tsx`: fixed application navigation.
- `src/renderer/src/components/FileBrowser.tsx`: shared list/grid browser surface.
- `src/renderer/src/components/FileBrowserToolbar.tsx`: breadcrumbs, search, refresh, and view switch.
- `src/renderer/src/components/HomePanel.tsx`: local status and recent received files.
- `src/renderer/src/components/ReceivedFilesPanel.tsx`: local receive library and actions.
- `src/renderer/src/components/SharedFilesPanel.tsx`: local read-only shared library.
- `src/renderer/src/components/PeerSharedFilesPanel.tsx`: in-app remote shared browser.
- `src/renderer/src/components/DeviceDropTarget.tsx`: explicit drag-and-drop send target.

Modify these integration files:

- `src/main/main.ts`: composition only; register the new modules and notifications.
- `src/main/preload.ts`: expose typed file operations and dropped-file path conversion.
- `src/main/core/lanServer.ts`: conflict-safe uploads and upload-complete callback.
- `src/renderer/src/api.ts`: serializable API contracts.
- `src/renderer/src/App.tsx`: page routing and high-level state only.
- `src/renderer/src/components/NearbyDevices.tsx`: open in-app shared browser and drop targets.
- `src/mobile/src/MobileApp.tsx`: retain mobile parity with the same browse semantics.
- `src/renderer/src/styles.css` and `src/mobile/src/mobile.css`: File Explorer-inspired responsive styling.

## Task 1: Capture The Current Stable Baseline

**Files:**
- Modify: current tracked application files already changed in the working tree
- Exclude: `make_wechat_minimal_bg.py`, `outputs/`, and generated screenshots

- [ ] **Step 1: Verify the current baseline**

Run:

```powershell
cmd /c npm run lint:types
cmd /c npm run test
cmd /c npm run build
```

Expected: type check exits 0, all 83 current tests pass, and desktop/mobile builds finish.

- [ ] **Step 2: Stage only the LAN application baseline**

Run:

```powershell
git add electron.vite.config.ts package.json package-lock.json src tests
git status --short
```

Expected: application source and tests are staged; `make_wechat_minimal_bg.py`, `outputs/`, and screenshots remain unstaged.

- [ ] **Step 3: Commit the baseline**

```powershell
git commit -m "fix: stabilize pairing and shared file access"
```

Expected: the commit succeeds and the unrelated files remain untracked.

## Task 2: Add Shared File Browser Types And Metadata

**Files:**
- Create: `src/shared/fileBrowserTypes.ts`
- Create: `src/main/core/fileLibrary.ts`
- Create: `tests/core/fileLibrary.test.ts`
- Modify: `src/main/core/sharedFolder.ts`

- [ ] **Step 1: Write the failing metadata tests**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { listLocalDirectory } from "../../src/main/core/fileLibrary";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.promises.rm(root, { recursive: true, force: true })));
});

describe("file library", () => {
  test("returns folders first with size, kind, and modified time", async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lan-file-library-"));
    roots.push(root);
    await fs.promises.mkdir(path.join(root, "Photos"));
    await fs.promises.writeFile(path.join(root, "report.pdf"), "report");

    const entries = await listLocalDirectory(root, "");

    expect(entries.map(({ name, kind }) => ({ name, kind }))).toEqual([
      { name: "Photos", kind: "directory" },
      { name: "report.pdf", kind: "document" }
    ]);
    expect(entries[1]).toMatchObject({ size: 6, extension: ".pdf" });
    expect(entries[1].modifiedAt).toEqual(expect.any(Number));
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `cmd /c npx vitest run tests/core/fileLibrary.test.ts`

Expected: FAIL because `fileLibrary.ts` does not exist.

- [ ] **Step 3: Define the serializable contracts**

```ts
export type FileKind = "directory" | "image" | "video" | "audio" | "archive" | "document" | "other";
export type FileBrowserView = "list" | "grid";
export type FileBrowserSource = "shared-local" | "received-local" | "peer-shared";

export type FileBrowserEntry = {
  name: string;
  relativePath: string;
  kind: FileKind;
  extension: string;
  size: number;
  modifiedAt: number;
  previewUrl?: string;
};

export type FileBrowserLocation = {
  source: FileBrowserSource;
  relativePath: string;
  peerDeviceId?: string;
};
```

- [ ] **Step 4: Implement local directory metadata mapping**

```ts
import fs from "node:fs";
import path from "node:path";
import type { FileBrowserEntry, FileKind } from "../../shared/fileBrowserTypes";
import { resolveSharedRealPath } from "./pathSafety";

export async function listLocalDirectory(root: string, relativePath: string): Promise<FileBrowserEntry[]> {
  const resolved = await resolveSharedRealPath(root, relativePath);
  if (!resolved.ok) throw new Error(`Invalid file browser path: ${resolved.reason}`);

  const dirents = await fs.promises.readdir(resolved.path, { withFileTypes: true });
  const entries = await Promise.all(dirents.map(async (dirent) => {
    const childRelativePath = path.posix.join(relativePath.replace(/\\/g, "/"), dirent.name);
    const child = await resolveSharedRealPath(root, childRelativePath);
    if (!child.ok) throw new Error(`Invalid file browser path: ${child.reason}`);
    const stats = await fs.promises.stat(child.path);
    const extension = dirent.isDirectory() ? "" : path.extname(dirent.name).toLowerCase();
    return {
      name: dirent.name,
      relativePath: childRelativePath,
      kind: dirent.isDirectory() ? "directory" : classifyExtension(extension),
      extension,
      size: stats.size,
      modifiedAt: stats.mtimeMs
    } satisfies FileBrowserEntry;
  }));

  return entries.sort((left, right) =>
    left.kind === right.kind ? left.name.localeCompare(right.name) : left.kind === "directory" ? -1 : 1
  );
}

function classifyExtension(extension: string): FileKind {
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(extension)) return "image";
  if ([".mp4", ".mov", ".mkv", ".webm"].includes(extension)) return "video";
  if ([".mp3", ".wav", ".flac", ".m4a"].includes(extension)) return "audio";
  if ([".zip", ".7z", ".rar", ".tar", ".gz"].includes(extension)) return "archive";
  if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"].includes(extension)) return "document";
  return "other";
}
```

- [ ] **Step 5: Reuse the mapper for shared-folder HTTP responses**

Change `listSharedFolder()` to return `FileBrowserEntry[]` by delegating to `listLocalDirectory(root, relativePath)`. Keep the existing realpath boundary tests.

- [ ] **Step 6: Run tests and commit**

Run: `cmd /c npx vitest run tests/core/fileLibrary.test.ts tests/core/sharedFolder.test.ts`

Expected: both test files pass.

```powershell
git add src/shared/fileBrowserTypes.ts src/main/core/fileLibrary.ts src/main/core/sharedFolder.ts tests/core/fileLibrary.test.ts
git commit -m "feat: add typed file library metadata"
```

## Task 3: Make Receiving Conflict-Safe And Observable

**Files:**
- Create: `src/main/core/receivedFiles.ts`
- Create: `tests/core/receivedFiles.test.ts`
- Modify: `src/main/core/lanServer.ts`
- Modify: `tests/core/lanServer.test.ts`

- [ ] **Step 1: Write failing conflict-safe path tests**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { chooseReceivedPath } from "../../src/main/core/receivedFiles";

describe("received files", () => {
  test("keeps both files when a name already exists", async () => {
    const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), "lan-received-"));
    await fs.promises.writeFile(path.join(root, "Photo.jpg"), "old");

    const result = await chooseReceivedPath(root, "Photo.jpg");

    expect(result.relativePath).toBe("Photo (1).jpg");
    await fs.promises.rm(root, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cmd /c npx vitest run tests/core/receivedFiles.test.ts`

Expected: FAIL because `chooseReceivedPath` is missing.

- [ ] **Step 3: Implement conflict-safe receive paths**

```ts
import fs from "node:fs";
import path from "node:path";
import { chooseAvailableName } from "./fileNaming";

export async function chooseReceivedPath(root: string, relativePath: string): Promise<{ absolutePath: string; relativePath: string }> {
  const directory = path.join(root, path.dirname(relativePath));
  await fs.promises.mkdir(directory, { recursive: true });
  const names = new Set(await fs.promises.readdir(directory));
  const availableName = chooseAvailableName(path.basename(relativePath), names);
  const safeRelativePath = path.posix.join(path.dirname(relativePath).replace(/\\/g, "/"), availableName);
  return { absolutePath: path.join(directory, availableName), relativePath: safeRelativePath };
}
```

- [ ] **Step 4: Add an upload-complete callback to the server**

Add to `StartLanServerOptions`:

```ts
onUploadCompleted?: (file: { relativePath: string; absolutePath: string; size: number }) => void | Promise<void>;
```

Resolve the safe target before opening the write stream, and after a successful write call:

```ts
await onUploadCompleted?.({
  relativePath: uploadTarget.relativePath,
  absolutePath: uploadTarget.absolutePath,
  size: Number(request.get("content-length") ?? 0)
});
```

- [ ] **Step 5: Update the collision endpoint test**

Replace the current expectation that a collision fails with assertions that both `readme.txt` and `readme (1).txt` exist and contain their respective bytes.

- [ ] **Step 6: Run tests and commit**

Run: `cmd /c npx vitest run tests/core/receivedFiles.test.ts tests/core/lanServer.test.ts`

Expected: all tests pass.

```powershell
git add src/main/core/receivedFiles.ts src/main/core/lanServer.ts tests/core/receivedFiles.test.ts tests/core/lanServer.test.ts
git commit -m "feat: preserve conflicting received files"
```

## Task 4: Expose A Typed File-Library IPC Boundary

**Files:**
- Create: `src/main/fileLibraryIpc.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/src/api.ts`
- Create: `tests/core/fileLibraryIpcContracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, test } from "vitest";
import type { FileBrowserLocation } from "../../src/shared/fileBrowserTypes";
import type { LanTransferApi } from "../../src/renderer/src/api";

describe("file library IPC contract", () => {
  test("exposes browse and local file actions", () => {
    const location: FileBrowserLocation = { source: "received-local", relativePath: "" };
    const keys: Array<keyof LanTransferApi> = [
      "listFiles", "openLocalFile", "showLocalFile", "deleteReceivedFile", "downloadPeerFile"
    ];
    expect(location.source).toBe("received-local");
    expect(keys).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cmd /c npx vitest run tests/core/fileLibraryIpcContracts.test.ts`

Expected: TypeScript collection fails because the API methods are absent.

- [ ] **Step 3: Add renderer API signatures**

```ts
listFiles(location: FileBrowserLocation): Promise<FileBrowserEntry[]>;
openLocalFile(relativePath: string): Promise<void>;
showLocalFile(relativePath: string): Promise<void>;
deleteReceivedFile(relativePath: string): Promise<void>;
downloadPeerFile(deviceId: string, relativePath: string): Promise<string>;
getPathForDroppedFile(file: File): string;
```

- [ ] **Step 4: Implement focused IPC registration**

Export this composition function from `src/main/fileLibraryIpc.ts`:

```ts
export function registerFileLibraryIpc(options: {
  getSharedRoot(): string | undefined;
  getReceivedRoot(): string;
  listPeer(deviceId: string, relativePath: string): Promise<FileBrowserEntry[]>;
  downloadPeer(deviceId: string, relativePath: string): Promise<string>;
}): void;
```

Register `fileLibrary:list`, `fileLibrary:open`, `fileLibrary:show`, `fileLibrary:deleteReceived`, and `fileLibrary:downloadPeer`. Validate every relative path through `resolveSharedRealPath`; allow delete only under the received root.

- [ ] **Step 5: Expose exact preload wrappers**

```ts
listFiles: (location: FileBrowserLocation) => ipcRenderer.invoke("fileLibrary:list", location),
openLocalFile: (relativePath: string) => ipcRenderer.invoke("fileLibrary:open", relativePath),
showLocalFile: (relativePath: string) => ipcRenderer.invoke("fileLibrary:show", relativePath),
deleteReceivedFile: (relativePath: string) => ipcRenderer.invoke("fileLibrary:deleteReceived", relativePath),
downloadPeerFile: (deviceId: string, relativePath: string) => ipcRenderer.invoke("fileLibrary:downloadPeer", deviceId, relativePath),
getPathForDroppedFile: (file: File) => webUtils.getPathForFile(file)
```

Import `webUtils` from Electron in preload.

- [ ] **Step 6: Run type checks and commit**

Run: `cmd /c npm run lint:types`

Expected: exit 0.

```powershell
git add src/main/fileLibraryIpc.ts src/main/main.ts src/main/preload.ts src/renderer/src/api.ts tests/core/fileLibraryIpcContracts.test.ts
git commit -m "feat: expose typed file library IPC"
```

## Task 5: Build The Reusable File Browser Surface

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/renderer/src/components/FileBrowserToolbar.tsx`
- Create: `src/renderer/src/components/FileBrowser.tsx`
- Create: `tests/renderer/FileBrowser.test.tsx`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Install UI test and icon dependencies**

Run:

```powershell
cmd /c npm install lucide-react
cmd /c npm install -D @testing-library/react @testing-library/user-event jsdom
```

Expected: package files include the new dependencies without unrelated upgrades.

- [ ] **Step 2: Write the failing browser behavior test**

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { FileBrowser } from "../../src/renderer/src/components/FileBrowser";

test("opens a directory and switches to grid view", async () => {
  const onOpenDirectory = vi.fn();
  render(
    <FileBrowser
      entries={[{ name: "Photos", relativePath: "Photos", kind: "directory", extension: "", size: 0, modifiedAt: 1 }]}
      loading={false}
      location={{ source: "shared-local", relativePath: "" }}
      view="list"
      onChangeView={vi.fn()}
      onOpenDirectory={onOpenDirectory}
      onOpenFile={vi.fn()}
      onRefresh={vi.fn()}
    />
  );
  await userEvent.dblClick(screen.getByText("Photos"));
  expect(onOpenDirectory).toHaveBeenCalledWith("Photos");
});
```

- [ ] **Step 3: Run and verify failure**

Run: `cmd /c npx vitest run tests/renderer/FileBrowser.test.tsx`

Expected: FAIL because `FileBrowser` does not exist.

- [ ] **Step 4: Implement toolbar and browser contracts**

`FileBrowserToolbar` props:

```ts
type FileBrowserToolbarProps = {
  relativePath: string;
  query: string;
  view: FileBrowserView;
  onNavigate(path: string): void;
  onQueryChange(query: string): void;
  onRefresh(): void;
  onChangeView(view: FileBrowserView): void;
};
```

`FileBrowser` filters entries case-insensitively by query, renders columns for name, size, type, and modified time in list view, and renders stable aspect-ratio tiles in grid view. Use Lucide icons `Folder`, `File`, `Image`, `Video`, `Music`, `Archive`, `FileText`, `RefreshCw`, `List`, and `Grid3X3` with tooltips.

- [ ] **Step 5: Add stable responsive styles**

Use a fixed list grid:

```css
.fileHeader,
.fileRow {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 110px 140px 170px;
  align-items: center;
  min-height: 44px;
}

.fileGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
}

.fileTilePreview {
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 6px;
}
```

At widths below 760px, hide type and modified columns before allowing text overlap.

- [ ] **Step 6: Run tests and commit**

Run: `cmd /c npx vitest run tests/renderer/FileBrowser.test.tsx`

Expected: PASS.

```powershell
git add package.json package-lock.json src/renderer/src/components/FileBrowserToolbar.tsx src/renderer/src/components/FileBrowser.tsx src/renderer/src/styles.css tests/renderer/FileBrowser.test.tsx
git commit -m "feat: add reusable file browser"
```

## Task 6: Replace The Desktop Shell With Product Navigation

**Files:**
- Create: `src/renderer/src/components/AppNavigation.tsx`
- Create: `src/renderer/src/components/HomePanel.tsx`
- Create: `tests/renderer/AppNavigation.test.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Write the failing navigation test**

```tsx
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { AppNavigation } from "../../src/renderer/src/components/AppNavigation";

test("navigates to received files", async () => {
  const onNavigate = vi.fn();
  render(<AppNavigation activePage="home" deviceName="Office PC" onNavigate={onNavigate} />);
  await userEvent.click(screen.getByRole("button", { name: "接收文件" }));
  expect(onNavigate).toHaveBeenCalledWith("received");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cmd /c npx vitest run tests/renderer/AppNavigation.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement navigation pages**

```ts
export type AppPage = "home" | "devices" | "transfers" | "shared" | "received" | "mobile" | "settings";
```

Render buttons with `Home`, `Monitor`, `ArrowLeftRight`, `FolderOpen`, `Inbox`, `QrCode`, and `Settings` icons. Keep labels visible; do not use icon-only navigation.

- [ ] **Step 4: Reduce App.tsx to orchestration**

`App.tsx` owns only active page, app status, and page-level callbacks. Move the existing nearby-device JSX and file-browser state into their page components. Add a `HomePanel` with local status, online peer count, active transfer count, and the five most recently modified received entries.

- [ ] **Step 5: Run component tests and commit**

Run: `cmd /c npx vitest run tests/renderer/AppNavigation.test.tsx tests/renderer/FileBrowser.test.tsx`

Expected: PASS.

```powershell
git add src/renderer/src/App.tsx src/renderer/src/components/AppNavigation.tsx src/renderer/src/components/HomePanel.tsx src/renderer/src/styles.css tests/renderer/AppNavigation.test.tsx
git commit -m "feat: add product navigation shell"
```

## Task 7: Add Local Shared And Received File Pages

**Files:**
- Create: `src/renderer/src/components/SharedFilesPanel.tsx`
- Create: `src/renderer/src/components/ReceivedFilesPanel.tsx`
- Create: `tests/renderer/LocalFilePanels.test.tsx`
- Modify: `src/renderer/src/App.tsx`
- Delete: `src/renderer/src/components/SharedFolderPanel.tsx`

- [ ] **Step 1: Write failing local page tests**

Test these exact behaviors with React Testing Library:

```tsx
test("received files exposes open folder and file actions", async () => {
  render(<ReceivedFilesPanel entries={receivedEntries} loading={false} onRefresh={vi.fn()} onOpenFile={vi.fn()} onShowFile={vi.fn()} onDeleteFile={vi.fn()} onOpenReceiveFolder={vi.fn()} />);
  expect(screen.getByRole("button", { name: "打开接收文件夹" })).toBeVisible();
  expect(screen.getByText("Photo.jpg")).toBeVisible();
});

test("shared files explains read-only access", () => {
  render(<SharedFilesPanel rootPath="D:\\Shared" entries={[]} loading={false} onChooseRoot={vi.fn()} onRefresh={vi.fn()} />);
  expect(screen.getByText("远程设备只能浏览和下载，不能修改这里的文件。" )).toBeVisible();
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cmd /c npx vitest run tests/renderer/LocalFilePanels.test.tsx`

Expected: FAIL because both panels are missing.

- [ ] **Step 3: Implement panels with FileBrowser**

`SharedFilesPanel` shows the selected root above the browser and a `选择共享文件夹` command. `ReceivedFilesPanel` shows `打开接收文件夹`, supports double-click open, and uses an overflow menu for `打开所在位置` and `删除`.

- [ ] **Step 4: Confirm destructive actions**

Before deletion, render a modal with the exact message `删除“{name}”？此操作会删除电脑上的接收文件。` and explicit `取消` and `删除` buttons. Do not expose deletion for Shared Files.

- [ ] **Step 5: Run tests and commit**

Run: `cmd /c npx vitest run tests/renderer/LocalFilePanels.test.tsx`

Expected: PASS.

```powershell
git add src/renderer/src/App.tsx src/renderer/src/components/SharedFilesPanel.tsx src/renderer/src/components/ReceivedFilesPanel.tsx tests/renderer/LocalFilePanels.test.tsx
git rm src/renderer/src/components/SharedFolderPanel.tsx
git commit -m "feat: add shared and received file pages"
```

## Task 8: Browse And Download Peer Shared Files In-App

**Files:**
- Create: `src/main/core/peerSharedClient.ts`
- Create: `tests/core/peerSharedClient.test.ts`
- Create: `src/renderer/src/components/PeerSharedFilesPanel.tsx`
- Modify: `src/main/main.ts`
- Modify: `src/main/fileLibraryIpc.ts`
- Modify: `src/renderer/src/components/NearbyDevices.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Write failing peer client tests**

```ts
import { describe, expect, test, vi } from "vitest";
import { createPeerSharedClient } from "../../src/main/core/peerSharedClient";

test("lists an authenticated peer directory", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
  const client = createPeerSharedClient({ fetchImpl, getAccessToken: async () => "token" });
  await client.list({ host: "192.168.1.20", port: 43670, deviceId: "peer" }, "Photos");
  expect(fetchImpl).toHaveBeenCalledWith(
    "http://192.168.1.20:43670/api/shared/list?path=Photos",
    { headers: { authorization: "Bearer token" } }
  );
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cmd /c npx vitest run tests/core/peerSharedClient.test.ts`

Expected: FAIL because the client is missing.

- [ ] **Step 3: Implement peer list and download methods**

```ts
export interface PeerSharedClient {
  list(peer: PairingPeer, relativePath: string): Promise<FileBrowserEntry[]>;
  download(peer: PairingPeer, relativePath: string, receiveRoot: string): Promise<string>;
}
```

Use the pairing client to refresh a peer access token when needed. Stream downloads into the conflict-safe receive destination and return the final absolute path.

- [ ] **Step 4: Replace shell.openExternal browsing**

Remove `sharedFolder:browsePeer` behavior that opens the default browser. The Nearby Devices `浏览共享文件` action sets the active page to `peer-shared` and passes the selected device ID to `PeerSharedFilesPanel`.

- [ ] **Step 5: Render remote contents through FileBrowser**

Directories navigate in place. Double-clicking a file downloads it to Received Files, updates the transfer status, and exposes `打开文件` after completion.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
cmd /c npx vitest run tests/core/peerSharedClient.test.ts
cmd /c npm run lint:types
```

Expected: both commands succeed.

```powershell
git add src/main/core/peerSharedClient.ts src/main/main.ts src/main/fileLibraryIpc.ts src/renderer/src/App.tsx src/renderer/src/components/NearbyDevices.tsx src/renderer/src/components/PeerSharedFilesPanel.tsx tests/core/peerSharedClient.test.ts
git commit -m "feat: browse peer shared files in app"
```

## Task 9: Add Drag-And-Drop Sending

**Files:**
- Create: `src/renderer/src/components/DeviceDropTarget.tsx`
- Create: `tests/renderer/DeviceDropTarget.test.tsx`
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/src/api.ts`
- Modify: `src/renderer/src/components/NearbyDevices.tsx`

- [ ] **Step 1: Write the failing drop test**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DeviceDropTarget } from "../../src/renderer/src/components/DeviceDropTarget";

test("sends dropped files to the selected device", () => {
  const onDropPaths = vi.fn();
  render(<DeviceDropTarget deviceName="Office PC" disabled={false} onDropPaths={onDropPaths} />);
  const file = new File(["hello"], "hello.txt");
  fireEvent.drop(screen.getByText("拖到这里发送给 Office PC"), { dataTransfer: { files: [file] } });
  expect(onDropPaths).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cmd /c npx vitest run tests/renderer/DeviceDropTarget.test.tsx`

Expected: FAIL because the component is missing.

- [ ] **Step 3: Add explicit path-send IPC**

Expose:

```ts
sendPathsToPeer(deviceId: string, paths: string[]): Promise<void>;
```

The main handler rejects empty arrays, resolves each path, branches by `stat.isFile()` or `stat.isDirectory()`, and reuses existing streaming upload functions.

- [ ] **Step 4: Implement the drop target**

Convert every dropped `File` through `api.getPathForDroppedFile(file)`. Show a stable highlighted border during drag-over and the destination device name. Disable dropping for unpaired or offline devices.

- [ ] **Step 5: Run tests and commit**

Run: `cmd /c npx vitest run tests/renderer/DeviceDropTarget.test.tsx`

Expected: PASS.

```powershell
git add src/main/main.ts src/main/preload.ts src/renderer/src/api.ts src/renderer/src/components/NearbyDevices.tsx src/renderer/src/components/DeviceDropTarget.tsx tests/renderer/DeviceDropTarget.test.tsx
git commit -m "feat: send files with drag and drop"
```

## Task 10: Add Mobile Browser Parity

**Files:**
- Modify: `src/mobile/src/MobileApp.tsx`
- Modify: `src/mobile/src/mobile.css`
- Create: `tests/renderer/MobileApp.test.tsx`

- [ ] **Step 1: Write mobile behavior tests**

Mock `fetch` and verify:

```tsx
test("renders shared file metadata and enters directories", async () => {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ paired: true, accessToken: "token" }))
    .mockResolvedValueOnce(jsonResponse({ entries: [photosDirectory] }))
    .mockResolvedValueOnce(jsonResponse({ entries: [photoFile] }));
  render(<MobileApp />);
  await userEvent.click(await screen.findByRole("button", { name: "Photos" }));
  expect(await screen.findByText("Photo.jpg")).toBeVisible();
});
```

Also verify list/grid switching, refresh, upload success, and the explicit `电脑尚未选择共享文件夹。` state.

- [ ] **Step 2: Run and verify current failures**

Run: `cmd /c npx vitest run tests/renderer/MobileApp.test.tsx`

Expected: FAIL for missing metadata and view-switch behavior.

- [ ] **Step 3: Reuse shared file types and formatting**

Import `FileBrowserEntry` from `src/shared/fileBrowserTypes.ts`. Render size and modified time in list mode, and image/video previews in grid mode. Keep upload controls separate from the read-only shared browser.

- [ ] **Step 4: Add mobile error recovery**

Provide visible `重新配对` when access is 403, `刷新` when listing fails, and `重试上传` when upload fails. Preserve the selected files until success or explicit removal.

- [ ] **Step 5: Run tests and commit**

Run: `cmd /c npx vitest run tests/renderer/MobileApp.test.tsx`

Expected: PASS.

```powershell
git add src/mobile/src/MobileApp.tsx src/mobile/src/mobile.css tests/renderer/MobileApp.test.tsx
git commit -m "feat: improve mobile file browsing"
```

## Task 11: Add Completion Notifications And Recent Files

**Files:**
- Create: `src/main/notifications.ts`
- Create: `tests/core/notificationPayload.test.ts`
- Modify: `src/main/main.ts`
- Modify: `src/renderer/src/components/HomePanel.tsx`

- [ ] **Step 1: Write the notification payload test**

```ts
import { expect, test } from "vitest";
import { createReceiveNotification } from "../../src/main/notifications";

test("creates a concise receive notification", () => {
  expect(createReceiveNotification({ name: "Photo.jpg", absolutePath: "C:\\Downloads\\Photo.jpg" })).toEqual({
    title: "文件接收完成",
    body: "Photo.jpg",
    absolutePath: "C:\\Downloads\\Photo.jpg"
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cmd /c npx vitest run tests/core/notificationPayload.test.ts`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement Windows notifications**

Use Electron `Notification`. On click, call `shell.showItemInFolder(absolutePath)`. Trigger only after the server reports a successful final file write; do not notify for partial or failed files.

- [ ] **Step 4: Populate Home recent files**

List the five most recently modified Received Files entries and provide `打开` and `打开所在位置` actions.

- [ ] **Step 5: Run tests and commit**

Run: `cmd /c npx vitest run tests/core/notificationPayload.test.ts`

Expected: PASS.

```powershell
git add src/main/notifications.ts src/main/main.ts src/renderer/src/components/HomePanel.tsx tests/core/notificationPayload.test.ts
git commit -m "feat: notify completed receives"
```

## Task 12: Integration, Visual QA, And Portable Build

**Files:**
- Modify: `docs/manual-test-checklist.md`
- Modify: `package.json` only if a dedicated renderer test script is needed

- [ ] **Step 1: Run the complete automated verification**

```powershell
cmd /c npm run lint:types
cmd /c npm run test
cmd /c npm run build
```

Expected: every command exits 0; no test is skipped.

- [ ] **Step 2: Start the desktop application and verify all pages**

Run: `cmd /c npm run dev`

Verify at 1120x760 and the minimum 900x620 window size:

- Navigation labels do not clip.
- List columns remain aligned.
- Grid tiles keep a stable aspect ratio.
- Long Chinese names wrap or ellipsize without overlap.
- Empty, loading, error, and populated states are visible.
- No page is blank.

- [ ] **Step 3: Verify the mobile page at two viewports**

Use browser automation at 390x844 and 768x1024. Verify upload, list/grid switch, folder navigation, metadata, download, pairing rejection, and refresh. Capture screenshots for both viewports.

- [ ] **Step 4: Perform two-device workflow checks**

On two Windows computers on the same private network:

1. Pair once.
2. Drag a file and a nested folder onto the peer.
3. Confirm original names and conflict suffixes.
4. Browse peer shared files in-app.
5. Download a peer file and open it from Received Files.
6. Upload from Android or iPhone and open the result from the desktop app.

- [ ] **Step 5: Update the manual checklist**

Add explicit Phase 1 rows for every item in Steps 2-4, including expected result and pass/fail space.

- [ ] **Step 6: Build and smoke-test the portable executable**

```powershell
cmd /c npm run dist:win
```

Start `dist/LAN File Transfer 0.1.0.exe`, wait for `/api/device` to respond, and confirm the packaged renderer and mobile page contain the new navigation and browser controls.

- [ ] **Step 7: Commit verification documentation**

```powershell
git add docs/manual-test-checklist.md package.json package-lock.json
git commit -m "test: document file browser release checks"
```

Expected: the branch ends with a clean set of Phase 1 commits; unrelated workspace files remain untouched.
