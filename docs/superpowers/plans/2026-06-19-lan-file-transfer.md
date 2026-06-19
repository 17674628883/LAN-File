# LAN File Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows Electron app that transfers files on the local network, auto-discovers other Windows peers, pairs trusted devices, exposes a shared folder, and lets phones join through a QR web page.

**Architecture:** Use Electron for the Windows desktop shell, React for the desktop renderer and mobile web UI, Express for the local LAN HTTP service, WebSocket for live state updates, and mDNS for LAN discovery. Keep core behavior in small TypeScript modules under `src/main/core` so discovery, pairing, shared-folder path safety, and transfer logic can be tested without launching Electron.

**Tech Stack:** Electron, Vite, React, TypeScript, Vitest, Express, ws, multer/busboy-style streaming, bonjour-service, qrcode, electron-store, npm scripts.

---

## File Structure

Create this project structure:

```text
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
electron.vite.config.ts
src/
  main/
    main.ts
    preload.ts
    core/
      deviceIdentity.ts
      trustedDevices.ts
      pairing.ts
      pathSafety.ts
      fileNaming.ts
      transferTypes.ts
      lanAddress.ts
      discovery.ts
      lanServer.ts
      sharedFolder.ts
      transferStore.ts
  renderer/
    index.html
    src/
      App.tsx
      main.tsx
      styles.css
      api.ts
      components/
        NearbyDevices.tsx
        Transfers.tsx
        SharedFolderPanel.tsx
        MobileQrPanel.tsx
        PairingDialog.tsx
  mobile/
    index.html
    src/
      MobileApp.tsx
      main.tsx
      mobile.css
tests/
  core/
    deviceIdentity.test.ts
    trustedDevices.test.ts
    pairing.test.ts
    pathSafety.test.ts
    fileNaming.test.ts
    transferStore.test.ts
```

Responsibilities:

- `src/main/core/deviceIdentity.ts`: creates and loads the local device identity.
- `src/main/core/trustedDevices.ts`: stores trusted device records and trust removal.
- `src/main/core/pairing.ts`: decides when a remote device needs confirmation.
- `src/main/core/pathSafety.ts`: keeps shared-folder access inside the selected root.
- `src/main/core/fileNaming.ts`: resolves receive-name conflicts with numbered suffixes.
- `src/main/core/transferStore.ts`: tracks active, completed, failed, and canceled transfers.
- `src/main/core/discovery.ts`: advertises and discovers LAN peers.
- `src/main/core/lanServer.ts`: exposes HTTP/WebSocket endpoints for devices and phones.
- `src/main/core/sharedFolder.ts`: lists and streams files from the selected shared root.
- `src/main/main.ts`: wires Electron, IPC, discovery, server, and windows together.
- `src/renderer/*`: desktop app UI.
- `src/mobile/*`: phone browser UI.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `electron.vite.config.ts`
- Create: `src/main/main.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/styles.css`

- [ ] **Step 1: Initialize git repository**

Run:

```powershell
git init
git status --short
```

Expected: git reports an empty repository with existing docs as untracked files.

- [ ] **Step 2: Create npm package**

Create `package.json`:

```json
{
  "name": "lan-file-transfer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist-electron/main/main.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "npm run test && electron-vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint:types": "tsc --noEmit",
    "dist:win": "electron-builder --win portable"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "bonjour-service": "^1.3.0",
    "electron-store": "^10.0.0",
    "express": "^4.19.2",
    "qrcode": "^1.5.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/ws": "^8.5.12",
    "electron": "^34.0.0",
    "electron-builder": "^25.1.0",
    "electron-vite": "^3.0.0",
    "typescript": "^5.5.4",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Add TypeScript and build config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "tests", "*.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
```

Create `electron.vite.config.ts`:

```ts
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: "src/main/main.ts"
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: "src/main/preload.ts"
      }
    }
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()]
  }
});
```

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()]
});
```

- [ ] **Step 4: Add minimal Electron and React entry points**

Create `src/main/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

Create `src/main/preload.ts`:

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("lanTransfer", {
  version: "0.1.0"
});
```

Create `src/renderer/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LAN File Transfer</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/renderer/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/renderer/src/App.tsx`:

```tsx
export function App(): JSX.Element {
  return (
    <main className="appShell">
      <aside className="sidebar">
        <h1>局域网快传</h1>
        <button>附近设备</button>
        <button>传输</button>
        <button>共享文件夹</button>
        <button>手机扫码</button>
      </aside>
      <section className="content">
        <h2>附近设备</h2>
        <p>打开同一局域网内其他电脑上的软件后，会自动显示在这里。</p>
      </section>
    </main>
  );
}
```

Create `src/renderer/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Segoe UI", system-ui, sans-serif;
  color: #172033;
  background: #f6f7f9;
}

button {
  font: inherit;
}

.appShell {
  display: grid;
  grid-template-columns: 220px 1fr;
  min-height: 100vh;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  background: #ffffff;
  border-right: 1px solid #dde2ea;
}

.sidebar h1 {
  margin: 0 0 16px;
  font-size: 20px;
}

.sidebar button {
  min-height: 38px;
  border: 1px solid #cfd7e3;
  border-radius: 6px;
  background: #ffffff;
  text-align: left;
  padding: 0 12px;
}

.content {
  padding: 28px;
}
```

- [ ] **Step 5: Install dependencies**

Run:

```powershell
npm install
```

Expected: `node_modules` and `package-lock.json` are created without dependency resolution errors.

- [ ] **Step 6: Run scaffold checks**

Run:

```powershell
npm run lint:types
npm run test
```

Expected: TypeScript passes and Vitest reports no test files or zero failing tests.

- [ ] **Step 7: Commit scaffold**

Run:

```powershell
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts electron.vite.config.ts src docs
git commit -m "chore: scaffold lan transfer app"
```

Expected: commit succeeds.

## Task 2: Device Identity and Trusted Device Store

**Files:**
- Create: `src/main/core/deviceIdentity.ts`
- Create: `src/main/core/trustedDevices.ts`
- Create: `tests/core/deviceIdentity.test.ts`
- Create: `tests/core/trustedDevices.test.ts`

- [ ] **Step 1: Write device identity tests**

Create `tests/core/deviceIdentity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDeviceIdentity, loadOrCreateDeviceIdentity, type IdentityStore } from "../../src/main/core/deviceIdentity";

class MemoryIdentityStore implements IdentityStore {
  value: unknown;
  get(): unknown {
    return this.value;
  }
  set(value: unknown): void {
    this.value = value;
  }
}

describe("device identity", () => {
  it("creates a stable identity shape", () => {
    const identity = createDeviceIdentity("Office PC");

    expect(identity.deviceId).toMatch(/^dev_/);
    expect(identity.secret).toMatch(/^sec_/);
    expect(identity.displayName).toBe("Office PC");
    expect(identity.createdAt).toBeGreaterThan(0);
  });

  it("loads an existing identity instead of creating a new one", () => {
    const store = new MemoryIdentityStore();
    const first = loadOrCreateDeviceIdentity(store, "Office PC");
    const second = loadOrCreateDeviceIdentity(store, "Renamed PC");

    expect(second).toEqual(first);
  });
});
```

- [ ] **Step 2: Run identity test to verify it fails**

Run:

```powershell
npm run test -- tests/core/deviceIdentity.test.ts
```

Expected: FAIL because `src/main/core/deviceIdentity.ts` does not exist.

- [ ] **Step 3: Implement device identity**

Create `src/main/core/deviceIdentity.ts`:

```ts
import crypto from "node:crypto";

export type DeviceIdentity = {
  deviceId: string;
  secret: string;
  displayName: string;
  createdAt: number;
};

export type IdentityStore = {
  get(): unknown;
  set(value: unknown): void;
};

function isDeviceIdentity(value: unknown): value is DeviceIdentity {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.deviceId === "string" &&
    typeof candidate.secret === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.createdAt === "number"
  );
}

export function createDeviceIdentity(displayName: string): DeviceIdentity {
  return {
    deviceId: `dev_${crypto.randomUUID()}`,
    secret: `sec_${crypto.randomBytes(32).toString("hex")}`,
    displayName,
    createdAt: Date.now()
  };
}

export function loadOrCreateDeviceIdentity(store: IdentityStore, displayName: string): DeviceIdentity {
  const existing = store.get();
  if (isDeviceIdentity(existing)) return existing;

  const identity = createDeviceIdentity(displayName);
  store.set(identity);
  return identity;
}
```

- [ ] **Step 4: Write trusted device tests**

Create `tests/core/trustedDevices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTrustedDeviceStore, type TrustedDeviceRecord, type TrustedDevicesStore } from "../../src/main/core/trustedDevices";

class MemoryTrustedDevicesStore implements TrustedDevicesStore {
  value: TrustedDeviceRecord[] = [];
  get(): TrustedDeviceRecord[] {
    return this.value;
  }
  set(value: TrustedDeviceRecord[]): void {
    this.value = value;
  }
}

describe("trusted devices", () => {
  it("trusts and finds a device by id", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({
      deviceId: "dev_peer",
      displayName: "Peer PC",
      deviceType: "desktop",
      trustedAt: 100,
      lastSeenAt: 100
    });

    expect(store.isTrusted("dev_peer")).toBe(true);
    expect(store.list()).toHaveLength(1);
  });

  it("updates an existing trusted device instead of duplicating it", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({ deviceId: "dev_peer", displayName: "Old", deviceType: "desktop", trustedAt: 100, lastSeenAt: 100 });
    store.trust({ deviceId: "dev_peer", displayName: "New", deviceType: "desktop", trustedAt: 100, lastSeenAt: 200 });

    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].displayName).toBe("New");
    expect(store.list()[0].lastSeenAt).toBe(200);
  });

  it("removes trust for a device", () => {
    const backing = new MemoryTrustedDevicesStore();
    const store = createTrustedDeviceStore(backing);

    store.trust({ deviceId: "dev_peer", displayName: "Peer PC", deviceType: "desktop", trustedAt: 100, lastSeenAt: 100 });
    store.remove("dev_peer");

    expect(store.isTrusted("dev_peer")).toBe(false);
  });
});
```

- [ ] **Step 5: Implement trusted devices**

Create `src/main/core/trustedDevices.ts`:

```ts
export type DeviceType = "desktop" | "phone";

export type TrustedDeviceRecord = {
  deviceId: string;
  displayName: string;
  deviceType: DeviceType;
  trustedAt: number;
  lastSeenAt: number;
};

export type TrustedDevicesStore = {
  get(): TrustedDeviceRecord[];
  set(value: TrustedDeviceRecord[]): void;
};

export type TrustedDeviceStoreApi = {
  list(): TrustedDeviceRecord[];
  isTrusted(deviceId: string): boolean;
  trust(record: TrustedDeviceRecord): void;
  remove(deviceId: string): void;
};

export function createTrustedDeviceStore(store: TrustedDevicesStore): TrustedDeviceStoreApi {
  return {
    list() {
      return [...store.get()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    },
    isTrusted(deviceId) {
      return store.get().some((record) => record.deviceId === deviceId);
    },
    trust(record) {
      const next = store.get().filter((item) => item.deviceId !== record.deviceId);
      next.push(record);
      store.set(next);
    },
    remove(deviceId) {
      store.set(store.get().filter((item) => item.deviceId !== deviceId));
    }
  };
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm run test -- tests/core/deviceIdentity.test.ts tests/core/trustedDevices.test.ts
git add src/main/core/deviceIdentity.ts src/main/core/trustedDevices.ts tests/core/deviceIdentity.test.ts tests/core/trustedDevices.test.ts
git commit -m "feat: add device identity and trusted device store"
```

Expected: tests pass and commit succeeds.

## Task 3: Pairing Rules and Shared-Folder Path Safety

**Files:**
- Create: `src/main/core/pairing.ts`
- Create: `src/main/core/pathSafety.ts`
- Create: `tests/core/pairing.test.ts`
- Create: `tests/core/pathSafety.test.ts`

- [ ] **Step 1: Write pairing tests**

Create `tests/core/pairing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getPairingDecision, type RemoteDeviceSummary } from "../../src/main/core/pairing";

const desktop: RemoteDeviceSummary = {
  deviceId: "dev_desktop",
  displayName: "Office PC",
  deviceType: "desktop"
};

describe("pairing", () => {
  it("allows trusted devices", () => {
    expect(getPairingDecision(desktop, true)).toEqual({ action: "allow" });
  });

  it("asks for confirmation for untrusted devices", () => {
    expect(getPairingDecision(desktop, false)).toEqual({
      action: "confirm",
      prompt: "Office PC wants to connect to this computer."
    });
  });
});
```

- [ ] **Step 2: Write path safety tests**

Create `tests/core/pathSafety.test.ts`:

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSharedPath } from "../../src/main/core/pathSafety";

describe("shared folder path safety", () => {
  const root = path.resolve("C:/Users/Test/Shared");

  it("resolves a normal child path", () => {
    const result = resolveSharedPath(root, "photos/a.jpg");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.path).toBe(path.join(root, "photos/a.jpg"));
  });

  it("rejects parent traversal", () => {
    const result = resolveSharedPath(root, "../secret.txt");
    expect(result).toEqual({ ok: false, reason: "Path escapes shared folder." });
  });

  it("rejects absolute paths outside the root", () => {
    const result = resolveSharedPath(root, "C:/Windows/win.ini");
    expect(result).toEqual({ ok: false, reason: "Path escapes shared folder." });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm run test -- tests/core/pairing.test.ts tests/core/pathSafety.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 4: Implement pairing**

Create `src/main/core/pairing.ts`:

```ts
import type { DeviceType } from "./trustedDevices";

export type RemoteDeviceSummary = {
  deviceId: string;
  displayName: string;
  deviceType: DeviceType;
};

export type PairingDecision =
  | { action: "allow" }
  | { action: "confirm"; prompt: string };

export function getPairingDecision(remote: RemoteDeviceSummary, trusted: boolean): PairingDecision {
  if (trusted) return { action: "allow" };
  return {
    action: "confirm",
    prompt: `${remote.displayName} wants to connect to this computer.`
  };
}
```

- [ ] **Step 5: Implement path safety**

Create `src/main/core/pathSafety.ts`:

```ts
import path from "node:path";

export type SafePathResult =
  | { ok: true; path: string }
  | { ok: false; reason: string };

export function resolveSharedPath(sharedRoot: string, requestedPath: string): SafePathResult {
  const root = path.resolve(sharedRoot);
  const target = path.resolve(root, requestedPath);
  const relative = path.relative(root, target);
  const escapesRoot = relative.startsWith("..") || path.isAbsolute(relative);

  if (escapesRoot) {
    return { ok: false, reason: "Path escapes shared folder." };
  }

  return { ok: true, path: target };
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm run test -- tests/core/pairing.test.ts tests/core/pathSafety.test.ts
git add src/main/core/pairing.ts src/main/core/pathSafety.ts tests/core/pairing.test.ts tests/core/pathSafety.test.ts
git commit -m "feat: add pairing and shared path safety"
```

Expected: tests pass and commit succeeds.

## Task 4: File Naming and Transfer Store

**Files:**
- Create: `src/main/core/fileNaming.ts`
- Create: `src/main/core/transferTypes.ts`
- Create: `src/main/core/transferStore.ts`
- Create: `tests/core/fileNaming.test.ts`
- Create: `tests/core/transferStore.test.ts`

- [ ] **Step 1: Write file naming tests**

Create `tests/core/fileNaming.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseAvailableName } from "../../src/main/core/fileNaming";

describe("file naming", () => {
  it("keeps the original name when it is available", () => {
    const name = chooseAvailableName("Photo.jpg", new Set(["Other.jpg"]));
    expect(name).toBe("Photo.jpg");
  });

  it("adds a numbered suffix before the extension", () => {
    const existing = new Set(["Photo.jpg", "Photo (1).jpg"]);
    const name = chooseAvailableName("Photo.jpg", existing);
    expect(name).toBe("Photo (2).jpg");
  });
});
```

- [ ] **Step 2: Write transfer store tests**

Create `tests/core/transferStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTransferStore } from "../../src/main/core/transferStore";

describe("transfer store", () => {
  it("tracks progress and completion", () => {
    const store = createTransferStore();
    store.start({ id: "t1", name: "Video.mp4", direction: "receive", totalBytes: 100 });
    store.progress("t1", 40);
    store.complete("t1");

    expect(store.list()[0]).toMatchObject({
      id: "t1",
      transferredBytes: 100,
      status: "completed"
    });
  });

  it("tracks failure and retry state", () => {
    const store = createTransferStore();
    store.start({ id: "t1", name: "Video.mp4", direction: "send", totalBytes: 100 });
    store.fail("t1", "Connection lost");

    expect(store.list()[0]).toMatchObject({
      status: "failed",
      error: "Connection lost"
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```powershell
npm run test -- tests/core/fileNaming.test.ts tests/core/transferStore.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 4: Implement file naming**

Create `src/main/core/fileNaming.ts`:

```ts
import path from "node:path";

export function chooseAvailableName(requestedName: string, existingNames: Set<string>): string {
  if (!existingNames.has(requestedName)) return requestedName;

  const extension = path.extname(requestedName);
  const base = requestedName.slice(0, requestedName.length - extension.length);

  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${base} (${index})${extension}`;
    if (!existingNames.has(candidate)) return candidate;
  }

  throw new Error(`No available name for ${requestedName}`);
}
```

- [ ] **Step 5: Implement transfer types and store**

Create `src/main/core/transferTypes.ts`:

```ts
export type TransferDirection = "send" | "receive";
export type TransferStatus = "active" | "completed" | "failed" | "canceled";

export type TransferTask = {
  id: string;
  name: string;
  direction: TransferDirection;
  totalBytes: number;
  transferredBytes: number;
  status: TransferStatus;
  startedAt: number;
  updatedAt: number;
  error?: string;
};

export type StartTransferInput = {
  id: string;
  name: string;
  direction: TransferDirection;
  totalBytes: number;
};
```

Create `src/main/core/transferStore.ts`:

```ts
import type { StartTransferInput, TransferTask } from "./transferTypes";

export type TransferStore = {
  list(): TransferTask[];
  start(input: StartTransferInput): void;
  progress(id: string, transferredBytes: number): void;
  complete(id: string): void;
  fail(id: string, error: string): void;
  cancel(id: string): void;
};

export function createTransferStore(now: () => number = Date.now): TransferStore {
  const tasks = new Map<string, TransferTask>();

  function update(id: string, updater: (task: TransferTask) => TransferTask): void {
    const current = tasks.get(id);
    if (!current) return;
    tasks.set(id, updater(current));
  }

  return {
    list() {
      return [...tasks.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    start(input) {
      const timestamp = now();
      tasks.set(input.id, {
        ...input,
        transferredBytes: 0,
        status: "active",
        startedAt: timestamp,
        updatedAt: timestamp
      });
    },
    progress(id, transferredBytes) {
      update(id, (task) => ({
        ...task,
        transferredBytes: Math.min(transferredBytes, task.totalBytes),
        updatedAt: now()
      }));
    },
    complete(id) {
      update(id, (task) => ({
        ...task,
        transferredBytes: task.totalBytes,
        status: "completed",
        updatedAt: now()
      }));
    },
    fail(id, error) {
      update(id, (task) => ({
        ...task,
        status: "failed",
        error,
        updatedAt: now()
      }));
    },
    cancel(id) {
      update(id, (task) => ({
        ...task,
        status: "canceled",
        updatedAt: now()
      }));
    }
  };
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
npm run test -- tests/core/fileNaming.test.ts tests/core/transferStore.test.ts
git add src/main/core/fileNaming.ts src/main/core/transferTypes.ts src/main/core/transferStore.ts tests/core/fileNaming.test.ts tests/core/transferStore.test.ts
git commit -m "feat: add transfer naming and state tracking"
```

Expected: tests pass and commit succeeds.

## Task 5: LAN Address, Discovery, and Server Skeleton

**Files:**
- Create: `src/main/core/lanAddress.ts`
- Create: `src/main/core/discovery.ts`
- Create: `src/main/core/lanServer.ts`
- Modify: `src/main/main.ts`

- [ ] **Step 1: Create LAN address helper**

Create `src/main/core/lanAddress.ts`:

```ts
import os from "node:os";

export function getLanAddress(): string {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "127.0.0.1";
}
```

- [ ] **Step 2: Create discovery wrapper**

Create `src/main/core/discovery.ts`:

```ts
import { Bonjour } from "bonjour-service";

export type PeerInfo = {
  name: string;
  host: string;
  port: number;
  deviceId: string;
};

export type DiscoveryService = {
  start(): void;
  stop(): void;
  onPeer(callback: (peer: PeerInfo) => void): void;
};

export function createDiscoveryService(input: {
  serviceName: string;
  port: number;
  deviceId: string;
}): DiscoveryService {
  const bonjour = new Bonjour();
  const callbacks = new Set<(peer: PeerInfo) => void>();
  let advertisement: ReturnType<Bonjour["publish"]> | undefined;
  let browser: ReturnType<Bonjour["find"]> | undefined;

  return {
    start() {
      advertisement = bonjour.publish({
        name: input.serviceName,
        type: "lan-transfer",
        port: input.port,
        txt: { deviceId: input.deviceId }
      });

      browser = bonjour.find({ type: "lan-transfer" });
      browser.on("up", (service) => {
        const deviceId = String(service.txt?.deviceId ?? "");
        if (!deviceId || deviceId === input.deviceId) return;
        callbacks.forEach((callback) =>
          callback({
            name: service.name,
            host: service.host,
            port: service.port,
            deviceId
          })
        );
      });
    },
    stop() {
      browser?.stop();
      advertisement?.stop();
      bonjour.destroy();
    },
    onPeer(callback) {
      callbacks.add(callback);
    }
  };
}
```

- [ ] **Step 3: Create server skeleton**

Create `src/main/core/lanServer.ts`:

```ts
import express from "express";
import http from "node:http";
import { WebSocketServer } from "ws";
import type { DeviceIdentity } from "./deviceIdentity";

export type LanServer = {
  port: number;
  url: string;
  close(): Promise<void>;
};

export async function startLanServer(input: {
  identity: DeviceIdentity;
  host: string;
  preferredPort: number;
}): Promise<LanServer> {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  app.get("/api/device", (_req, res) => {
    res.json({
      deviceId: input.identity.deviceId,
      displayName: input.identity.displayName,
      deviceType: "desktop"
    });
  });

  app.get("/mobile", (_req, res) => {
    res.type("html").send("<!doctype html><html><body><div id=\"root\">Mobile page loading...</div></body></html>");
  });

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "hello", deviceId: input.identity.deviceId }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.preferredPort, "0.0.0.0", () => resolve());
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : input.preferredPort;

  return {
    port,
    url: `http://${input.host}:${port}`,
    close() {
      return new Promise((resolve, reject) => {
        wss.close();
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };
}
```

- [ ] **Step 4: Wire server and discovery in main process**

Modify `src/main/main.ts` to include startup wiring:

```ts
import { app, BrowserWindow } from "electron";
import Store from "electron-store";
import os from "node:os";
import path from "node:path";
import { loadOrCreateDeviceIdentity } from "./core/deviceIdentity";
import { createDiscoveryService } from "./core/discovery";
import { getLanAddress } from "./core/lanAddress";
import { startLanServer, type LanServer } from "./core/lanServer";

let lanServer: LanServer | undefined;
let discovery: ReturnType<typeof createDiscoveryService> | undefined;

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

async function startServices(): Promise<void> {
  const store = new Store();
  const identity = loadOrCreateDeviceIdentity(
    {
      get: () => store.get("identity"),
      set: (value) => store.set("identity", value)
    },
    os.hostname()
  );
  const host = getLanAddress();
  lanServer = await startLanServer({ identity, host, preferredPort: 43670 });
  discovery = createDiscoveryService({
    serviceName: identity.displayName,
    port: lanServer.port,
    deviceId: identity.deviceId
  });
  discovery.start();
}

app.whenReady().then(async () => {
  await startServices();
  await createWindow();
});

app.on("before-quit", async () => {
  discovery?.stop();
  await lanServer?.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
```

- [ ] **Step 5: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/main/main.ts src/main/core/lanAddress.ts src/main/core/discovery.ts src/main/core/lanServer.ts
git commit -m "feat: start lan server and peer discovery"
```

Expected: TypeScript, tests, and Electron build pass.

## Task 6: Desktop IPC and UI Shell

**Files:**
- Modify: `src/main/preload.ts`
- Modify: `src/main/main.ts`
- Create: `src/renderer/src/api.ts`
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/components/NearbyDevices.tsx`
- Create: `src/renderer/src/components/Transfers.tsx`
- Create: `src/renderer/src/components/SharedFolderPanel.tsx`
- Create: `src/renderer/src/components/MobileQrPanel.tsx`
- Create: `src/renderer/src/components/PairingDialog.tsx`
- Modify: `src/renderer/src/styles.css`

- [ ] **Step 1: Expose renderer API through preload**

Modify `src/main/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("lanTransfer", {
  getStatus: () => ipcRenderer.invoke("status:get"),
  chooseSharedFolder: () => ipcRenderer.invoke("sharedFolder:choose"),
  removeTrustedDevice: (deviceId: string) => ipcRenderer.invoke("trustedDevices:remove", deviceId),
  respondToPairing: (requestId: string, accepted: boolean) =>
    ipcRenderer.invoke("pairing:respond", { requestId, accepted })
});
```

- [ ] **Step 2: Add renderer API types**

Create `src/renderer/src/api.ts`:

```ts
export type AppStatus = {
  deviceName: string;
  lanUrl: string;
  mobileUrl: string;
  peers: Array<{ deviceId: string; displayName: string; host: string; port: number; paired: boolean }>;
  transfers: Array<{ id: string; name: string; direction: string; progress: number; status: string; error?: string }>;
  sharedFolder?: string;
};

declare global {
  interface Window {
    lanTransfer: {
      getStatus(): Promise<AppStatus>;
      chooseSharedFolder(): Promise<string | undefined>;
      removeTrustedDevice(deviceId: string): Promise<void>;
      respondToPairing(requestId: string, accepted: boolean): Promise<void>;
    };
  }
}

export const api = window.lanTransfer;
```

- [ ] **Step 3: Add IPC handlers**

Modify `src/main/main.ts` by adding IPC handlers after service startup:

```ts
import { dialog, ipcMain } from "electron";

function registerIpcHandlers(): void {
  ipcMain.handle("status:get", () => ({
    deviceName: os.hostname(),
    lanUrl: lanServer?.url ?? "",
    mobileUrl: lanServer ? `${lanServer.url}/mobile` : "",
    peers: [],
    transfers: [],
    sharedFolder: undefined
  }));

  ipcMain.handle("sharedFolder:choose", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    return result.canceled ? undefined : result.filePaths[0];
  });

  ipcMain.handle("trustedDevices:remove", async (_event, _deviceId: string) => undefined);
  ipcMain.handle("pairing:respond", async (_event, _input: { requestId: string; accepted: boolean }) => undefined);
}
```

Call `registerIpcHandlers()` before `createWindow()`.

- [ ] **Step 4: Create UI components**

Create `src/renderer/src/components/NearbyDevices.tsx`:

```tsx
import type { AppStatus } from "../api";

export function NearbyDevices({ peers }: { peers: AppStatus["peers"] }): JSX.Element {
  return (
    <section>
      <h2>附近设备</h2>
      <div className="list">
        {peers.length === 0 ? <p>还没有发现设备。</p> : null}
        {peers.map((peer) => (
          <article className="row" key={peer.deviceId}>
            <div>
              <strong>{peer.displayName}</strong>
              <span>{peer.host}:{peer.port}</span>
            </div>
            <span>{peer.paired ? "已配对" : "未配对"}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
```

Create `src/renderer/src/components/Transfers.tsx`:

```tsx
import type { AppStatus } from "../api";

export function Transfers({ transfers }: { transfers: AppStatus["transfers"] }): JSX.Element {
  return (
    <section>
      <h2>传输</h2>
      <div className="list">
        {transfers.length === 0 ? <p>暂无传输任务。</p> : null}
        {transfers.map((transfer) => (
          <article className="row" key={transfer.id}>
            <div>
              <strong>{transfer.name}</strong>
              <span>{transfer.direction} · {transfer.status}</span>
            </div>
            <progress value={transfer.progress} max={100} />
          </article>
        ))}
      </div>
    </section>
  );
}
```

Create `src/renderer/src/components/SharedFolderPanel.tsx`:

```tsx
export function SharedFolderPanel({
  folder,
  onChoose
}: {
  folder?: string;
  onChoose(): void;
}): JSX.Element {
  return (
    <section>
      <h2>共享文件夹</h2>
      <p>{folder ?? "尚未选择共享文件夹。"}</p>
      <button onClick={onChoose}>选择文件夹</button>
    </section>
  );
}
```

Create `src/renderer/src/components/MobileQrPanel.tsx`:

```tsx
export function MobileQrPanel({ mobileUrl }: { mobileUrl: string }): JSX.Element {
  return (
    <section>
      <h2>手机扫码</h2>
      <p>{mobileUrl || "服务启动后会显示手机访问地址。"}</p>
      <div className="qrBox">{mobileUrl ? "二维码将在后续任务生成" : "未启动"}</div>
    </section>
  );
}
```

Create `src/renderer/src/components/PairingDialog.tsx`:

```tsx
export function PairingDialog(): JSX.Element | null {
  return null;
}
```

- [ ] **Step 5: Wire App state**

Modify `src/renderer/src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { api, type AppStatus } from "./api";
import { MobileQrPanel } from "./components/MobileQrPanel";
import { NearbyDevices } from "./components/NearbyDevices";
import { SharedFolderPanel } from "./components/SharedFolderPanel";
import { Transfers } from "./components/Transfers";

const emptyStatus: AppStatus = {
  deviceName: "",
  lanUrl: "",
  mobileUrl: "",
  peers: [],
  transfers: []
};

export function App(): JSX.Element {
  const [tab, setTab] = useState("devices");
  const [status, setStatus] = useState<AppStatus>(emptyStatus);

  useEffect(() => {
    api.getStatus().then(setStatus);
  }, []);

  async function chooseSharedFolder(): Promise<void> {
    const folder = await api.chooseSharedFolder();
    if (folder) setStatus((current) => ({ ...current, sharedFolder: folder }));
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <h1>局域网快传</h1>
        <button onClick={() => setTab("devices")}>附近设备</button>
        <button onClick={() => setTab("transfers")}>传输</button>
        <button onClick={() => setTab("shared")}>共享文件夹</button>
        <button onClick={() => setTab("mobile")}>手机扫码</button>
      </aside>
      <section className="content">
        {tab === "devices" ? <NearbyDevices peers={status.peers} /> : null}
        {tab === "transfers" ? <Transfers transfers={status.transfers} /> : null}
        {tab === "shared" ? <SharedFolderPanel folder={status.sharedFolder} onChoose={chooseSharedFolder} /> : null}
        {tab === "mobile" ? <MobileQrPanel mobileUrl={status.mobileUrl} /> : null}
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Update styles**

Append to `src/renderer/src/styles.css`:

```css
.list {
  display: grid;
  gap: 10px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 56px;
  padding: 12px;
  border: 1px solid #dde2ea;
  border-radius: 6px;
  background: #ffffff;
}

.row div {
  display: grid;
  gap: 4px;
}

.row span {
  color: #627085;
  font-size: 13px;
}

.qrBox {
  display: grid;
  place-items: center;
  width: 220px;
  height: 220px;
  border: 1px solid #cfd7e3;
  border-radius: 6px;
  background: #ffffff;
  color: #627085;
}
```

- [ ] **Step 7: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/main src/renderer
git commit -m "feat: add desktop ui shell"
```

Expected: TypeScript, tests, and build pass.

## Task 7: Shared Folder Listing and Download Endpoints

**Files:**
- Create: `src/main/core/sharedFolder.ts`
- Modify: `src/main/core/lanServer.ts`

- [ ] **Step 1: Implement shared folder module**

Create `src/main/core/sharedFolder.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { resolveSharedPath } from "./pathSafety";

export type SharedFolderEntry = {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
};

export async function listSharedFolder(root: string, relativePath = ""): Promise<SharedFolderEntry[]> {
  const safe = resolveSharedPath(root, relativePath);
  if (!safe.ok) throw new Error(safe.reason);

  const entries = await fs.readdir(safe.path, { withFileTypes: true });
  const result: SharedFolderEntry[] = [];

  for (const entry of entries) {
    const absolute = path.join(safe.path, entry.name);
    const stat = await fs.stat(absolute);
    result.push({
      name: entry.name,
      relativePath: path.join(relativePath, entry.name).replaceAll("\\", "/"),
      type: entry.isDirectory() ? "directory" : "file",
      size: stat.size
    });
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
```

- [ ] **Step 2: Add shared endpoints**

Modify `src/main/core/lanServer.ts` so `startLanServer` accepts optional shared-folder callbacks:

```ts
export async function startLanServer(input: {
  identity: DeviceIdentity;
  host: string;
  preferredPort: number;
  getSharedFolder?: () => string | undefined;
}): Promise<LanServer> {
```

Add imports:

```ts
import path from "node:path";
import { listSharedFolder } from "./sharedFolder";
import { resolveSharedPath } from "./pathSafety";
```

Add routes before `/mobile`:

```ts
  app.get("/api/shared/list", async (req, res) => {
    const root = input.getSharedFolder?.();
    if (!root) {
      res.status(404).json({ error: "Shared folder is not configured." });
      return;
    }

    try {
      const entries = await listSharedFolder(root, String(req.query.path ?? ""));
      res.json({ entries });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid shared folder path." });
    }
  });

  app.get("/api/shared/download", (req, res) => {
    const root = input.getSharedFolder?.();
    if (!root) {
      res.status(404).json({ error: "Shared folder is not configured." });
      return;
    }

    const safe = resolveSharedPath(root, String(req.query.path ?? ""));
    if (!safe.ok) {
      res.status(400).json({ error: safe.reason });
      return;
    }

    res.download(safe.path, path.basename(safe.path));
  });
```

- [ ] **Step 3: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/main/core/sharedFolder.ts src/main/core/lanServer.ts
git commit -m "feat: expose shared folder browsing endpoints"
```

Expected: TypeScript, tests, and build pass.

## Task 8: Mobile Web Page and QR Code

**Files:**
- Create: `src/mobile/index.html`
- Create: `src/mobile/src/main.tsx`
- Create: `src/mobile/src/MobileApp.tsx`
- Create: `src/mobile/src/mobile.css`
- Modify: `src/main/core/lanServer.ts`
- Modify: `src/renderer/src/components/MobileQrPanel.tsx`

- [ ] **Step 1: Create mobile React app**

Create `src/mobile/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>手机快传</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `src/mobile/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { MobileApp } from "./MobileApp";
import "./mobile.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
);
```

Create `src/mobile/src/MobileApp.tsx`:

```tsx
import { useEffect, useState } from "react";

type SharedEntry = {
  name: string;
  relativePath: string;
  type: "file" | "directory";
  size: number;
};

export function MobileApp(): JSX.Element {
  const [entries, setEntries] = useState<SharedEntry[]>([]);

  useEffect(() => {
    fetch("/api/shared/list")
      .then((response) => (response.ok ? response.json() : { entries: [] }))
      .then((body) => setEntries(body.entries ?? []));
  }, []);

  return (
    <main className="mobileShell">
      <h1>手机快传</h1>
      <form action="/api/upload" method="post" encType="multipart/form-data">
        <input type="file" name="files" multiple />
        <button type="submit">上传到电脑</button>
      </form>
      <section>
        <h2>共享文件夹</h2>
        {entries.map((entry) => (
          <a key={entry.relativePath} href={`/api/shared/download?path=${encodeURIComponent(entry.relativePath)}`}>
            {entry.name}
          </a>
        ))}
      </section>
    </main>
  );
}
```

Create `src/mobile/src/mobile.css`:

```css
body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f6f7f9;
  color: #172033;
}

.mobileShell {
  display: grid;
  gap: 20px;
  padding: 20px;
}

form,
section {
  display: grid;
  gap: 12px;
}

button,
input,
a {
  min-height: 44px;
  font: inherit;
}

a {
  display: flex;
  align-items: center;
  color: #0f5fcb;
}
```

- [ ] **Step 2: Serve built mobile assets**

Modify `src/main/core/lanServer.ts` so `/mobile` sends the static mobile shell during development:

```ts
  app.get("/mobile", (_req, res) => {
    res.type("html").send(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>手机快传</title>
  </head>
  <body>
    <main style="font-family: system-ui; padding: 20px">
      <h1>手机快传</h1>
      <form action="/api/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="files" multiple />
        <button type="submit">上传到电脑</button>
      </form>
      <p>共享文件夹下载会在配对后显示。</p>
    </main>
  </body>
</html>`);
  });
```

- [ ] **Step 3: Generate QR code in desktop UI**

Modify `src/renderer/src/components/MobileQrPanel.tsx`:

```tsx
import QRCode from "qrcode";
import { useEffect, useState } from "react";

export function MobileQrPanel({ mobileUrl }: { mobileUrl: string }): JSX.Element {
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!mobileUrl) {
      setQr("");
      return;
    }
    QRCode.toDataURL(mobileUrl, { width: 220, margin: 1 }).then(setQr);
  }, [mobileUrl]);

  return (
    <section>
      <h2>手机扫码</h2>
      <p>{mobileUrl || "服务启动后会显示手机访问地址。"}</p>
      <div className="qrBox">{qr ? <img src={qr} alt="手机访问二维码" /> : "未启动"}</div>
    </section>
  );
}
```

- [ ] **Step 4: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/mobile src/main/core/lanServer.ts src/renderer/src/components/MobileQrPanel.tsx
git commit -m "feat: add mobile web entry and qr code"
```

Expected: TypeScript, tests, and build pass.

## Task 9: Upload Endpoint and Receive Directory

**Files:**
- Modify: `src/main/core/lanServer.ts`
- Modify: `src/main/main.ts`

- [ ] **Step 1: Add receive-folder input to server**

Modify `startLanServer` input type:

```ts
export async function startLanServer(input: {
  identity: DeviceIdentity;
  host: string;
  preferredPort: number;
  getSharedFolder?: () => string | undefined;
  getReceiveFolder?: () => string;
}): Promise<LanServer> {
```

- [ ] **Step 2: Add upload route using streamed writes**

Add imports in `src/main/core/lanServer.ts`:

```ts
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { randomUUID } from "node:crypto";
```

Add route:

```ts
  app.post("/api/upload", async (req, res) => {
    const receiveFolder = input.getReceiveFolder?.();
    if (!receiveFolder) {
      res.status(500).json({ error: "Receive folder is not configured." });
      return;
    }

    await fsPromises.mkdir(receiveFolder, { recursive: true });
    const fileName = `${Date.now()}-${randomUUID()}.upload`;
    const destination = path.join(receiveFolder, fileName);
    const stream = fs.createWriteStream(destination);

    req.pipe(stream);
    req.on("error", () => {
      stream.destroy();
      res.status(500).json({ error: "Upload failed." });
    });
    stream.on("finish", () => {
      res.json({ ok: true, savedAs: fileName });
    });
  });
```

- [ ] **Step 3: Pass a receive folder from main process**

Modify `startServices()` in `src/main/main.ts`:

```ts
  lanServer = await startLanServer({
    identity,
    host,
    preferredPort: 43670,
    getReceiveFolder: () => path.join(app.getPath("downloads"), "LAN File Transfer")
  });
```

- [ ] **Step 4: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/main
git commit -m "feat: receive uploads from mobile and peers"
```

Expected: TypeScript, tests, and build pass.

## Task 10: Pairing Enforcement and Trusted Device Management

**Files:**
- Modify: `src/main/core/lanServer.ts`
- Modify: `src/main/main.ts`
- Modify: `src/renderer/src/components/PairingDialog.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Add pairing challenge route**

Modify `src/main/core/lanServer.ts` input:

```ts
  isTrusted?: (deviceId: string) => boolean;
  requestPairing?: (remote: { deviceId: string; displayName: string; deviceType: "desktop" | "phone" }) => Promise<boolean>;
```

Add route:

```ts
  app.post("/api/pair", async (req, res) => {
    const remote = {
      deviceId: String(req.body.deviceId ?? ""),
      displayName: String(req.body.displayName ?? "Unknown device"),
      deviceType: req.body.deviceType === "phone" ? "phone" as const : "desktop" as const
    };

    if (!remote.deviceId) {
      res.status(400).json({ error: "Missing device id." });
      return;
    }

    if (input.isTrusted?.(remote.deviceId)) {
      res.json({ paired: true });
      return;
    }

    const accepted = await input.requestPairing?.(remote);
    res.status(accepted ? 200 : 403).json({ paired: Boolean(accepted) });
  });
```

- [ ] **Step 2: Wire trusted store in main process**

In `src/main/main.ts`, import and initialize trusted devices:

```ts
import { createTrustedDeviceStore, type TrustedDeviceRecord } from "./core/trustedDevices";
```

Add inside `startServices()`:

```ts
  const trustedDevices = createTrustedDeviceStore({
    get: () => (store.get("trustedDevices") as TrustedDeviceRecord[] | undefined) ?? [],
    set: (value) => store.set("trustedDevices", value)
  });
```

Pass callbacks to `startLanServer`:

```ts
    isTrusted: (deviceId) => trustedDevices.isTrusted(deviceId),
    requestPairing: async (remote) => {
      const accepted = dialog.showMessageBoxSync({
        type: "question",
        buttons: ["允许", "拒绝"],
        defaultId: 0,
        cancelId: 1,
        title: "设备配对请求",
        message: `${remote.displayName} 想连接这台电脑。`
      }) === 0;

      if (accepted) {
        trustedDevices.trust({
          ...remote,
          trustedAt: Date.now(),
          lastSeenAt: Date.now()
        });
      }

      return accepted;
    }
```

- [ ] **Step 3: Guard shared-folder routes with trust**

In `src/main/core/lanServer.ts`, require `x-device-id` for shared routes:

```ts
function assertTrusted(req: express.Request, res: express.Response): boolean {
  const deviceId = String(req.header("x-device-id") ?? "");
  if (!deviceId || !input.isTrusted?.(deviceId)) {
    res.status(403).json({ error: "Device is not paired." });
    return false;
  }
  return true;
}
```

At the start of `/api/shared/list` and `/api/shared/download`, add:

```ts
    if (!assertTrusted(req, res)) return;
```

- [ ] **Step 4: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/main src/renderer
git commit -m "feat: enforce first-time device pairing"
```

Expected: TypeScript, tests, and build pass.

## Task 11: Windows-to-Windows Send Flow

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/renderer/src/api.ts`
- Modify: `src/renderer/src/components/NearbyDevices.tsx`
- Modify: `src/main/core/lanServer.ts`

- [ ] **Step 1: Add send-file IPC API**

Modify `src/main/preload.ts`:

```ts
  sendFileToPeer: (deviceId: string) => ipcRenderer.invoke("transfer:sendFileToPeer", deviceId),
```

Modify `src/renderer/src/api.ts`:

```ts
      sendFileToPeer(deviceId: string): Promise<void>;
```

- [ ] **Step 2: Add file picker and upload from main process**

In `src/main/main.ts`, track discovered peers in a map:

```ts
const peers = new Map<string, { deviceId: string; displayName: string; host: string; port: number; paired: boolean }>();
```

When discovery finds a peer, update the map:

```ts
  discovery.onPeer((peer) => {
    peers.set(peer.deviceId, {
      deviceId: peer.deviceId,
      displayName: peer.name,
      host: peer.host,
      port: peer.port,
      paired: false
    });
  });
```

Add IPC handler:

```ts
  ipcMain.handle("transfer:sendFileToPeer", async (_event, deviceId: string) => {
    const peer = peers.get(deviceId);
    if (!peer) throw new Error("Peer is offline.");

    const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"] });
    if (result.canceled) return;

    for (const filePath of result.filePaths) {
      const file = await fsPromises.readFile(filePath);
      const response = await fetch(`http://${peer.host}:${peer.port}/api/upload`, {
        method: "POST",
        headers: { "x-device-id": identity.deviceId },
        body: file
      });
      if (!response.ok) throw new Error(`Upload failed with ${response.status}`);
    }
  });
```

- [ ] **Step 3: Add button to nearby devices**

Modify `src/renderer/src/components/NearbyDevices.tsx`:

```tsx
export function NearbyDevices({
  peers,
  onSendFile
}: {
  peers: AppStatus["peers"];
  onSendFile(deviceId: string): void;
}): JSX.Element {
```

Inside each row, add:

```tsx
            <button onClick={() => onSendFile(peer.deviceId)}>发送文件</button>
```

Modify `App.tsx` to pass:

```tsx
<NearbyDevices peers={status.peers} onSendFile={(deviceId) => api.sendFileToPeer(deviceId)} />
```

- [ ] **Step 4: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/main src/renderer
git commit -m "feat: send files between windows peers"
```

Expected: TypeScript, tests, and build pass.

## Task 12: Folder Transfer and Transfer Controls

**Files:**
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/src/api.ts`
- Modify: `src/renderer/src/components/NearbyDevices.tsx`
- Modify: `src/renderer/src/components/Transfers.tsx`
- Modify: `src/main/core/lanServer.ts`

- [ ] **Step 1: Add folder send IPC API**

Modify `src/main/preload.ts`:

```ts
  sendFolderToPeer: (deviceId: string) => ipcRenderer.invoke("transfer:sendFolderToPeer", deviceId),
  cancelTransfer: (transferId: string) => ipcRenderer.invoke("transfer:cancel", transferId),
  retryTransfer: (transferId: string) => ipcRenderer.invoke("transfer:retry", transferId),
```

Modify `src/renderer/src/api.ts`:

```ts
      sendFolderToPeer(deviceId: string): Promise<void>;
      cancelTransfer(transferId: string): Promise<void>;
      retryTransfer(transferId: string): Promise<void>;
```

- [ ] **Step 2: Add recursive folder walker**

Create this helper inside `src/main/main.ts` near the transfer IPC handlers:

```ts
async function collectFiles(root: string): Promise<Array<{ absolutePath: string; relativePath: string }>> {
  const entries = await fsPromises.readdir(root, { withFileTypes: true });
  const files: Array<{ absolutePath: string; relativePath: string }> = [];

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const children = await collectFiles(absolutePath);
      files.push(
        ...children.map((child) => ({
          absolutePath: child.absolutePath,
          relativePath: path.join(entry.name, child.relativePath).replaceAll("\\", "/")
        }))
      );
    } else if (entry.isFile()) {
      files.push({ absolutePath, relativePath: entry.name });
    }
  }

  return files;
}
```

- [ ] **Step 3: Preserve relative paths on upload**

Modify `/api/upload` in `src/main/core/lanServer.ts` so it uses a safe target inside the receive folder:

```ts
    const requestedName = String(req.header("x-file-name") ?? `${Date.now()}-${randomUUID()}.upload`);
    const target = path.resolve(receiveFolder, requestedName);
    const relative = path.relative(receiveFolder, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      res.status(400).json({ error: "Invalid receive path." });
      return;
    }

    await fsPromises.mkdir(path.dirname(target), { recursive: true });
    const stream = fs.createWriteStream(target);
```

Remove the earlier `fileName` and `destination` variables, then return:

```ts
      res.json({ ok: true, savedAs: requestedName });
```

- [ ] **Step 4: Add folder upload IPC handler**

Add this handler in `registerIpcHandlers()`:

```ts
  ipcMain.handle("transfer:sendFolderToPeer", async (_event, deviceId: string) => {
    const peer = peers.get(deviceId);
    if (!peer) throw new Error("Peer is offline.");

    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled) return;

    const root = result.filePaths[0];
    const files = await collectFiles(root);

    for (const fileInfo of files) {
      const file = await fsPromises.readFile(fileInfo.absolutePath);
      const response = await fetch(`http://${peer.host}:${peer.port}/api/upload`, {
        method: "POST",
        headers: {
          "x-device-id": identity.deviceId,
          "x-file-name": fileInfo.relativePath
        },
        body: file
      });
      if (!response.ok) throw new Error(`Upload failed with ${response.status}`);
    }
  });
```

- [ ] **Step 5: Add cancel and retry handlers**

Add these handlers in `registerIpcHandlers()`:

```ts
  ipcMain.handle("transfer:cancel", async (_event, transferId: string) => {
    transferStore.cancel(transferId);
  });

  ipcMain.handle("transfer:retry", async (_event, transferId: string) => {
    const transfer = transferStore.list().find((item) => item.id === transferId);
    if (!transfer || transfer.status !== "failed") return;
    transferStore.start({
      id: `${transfer.id}-retry-${Date.now()}`,
      name: transfer.name,
      direction: transfer.direction,
      totalBytes: transfer.totalBytes
    });
  });
```

If `transferStore` is not in scope yet, create it once at module level:

```ts
import { createTransferStore } from "./core/transferStore";

const transferStore = createTransferStore();
```

- [ ] **Step 6: Add desktop controls**

Modify `src/renderer/src/components/NearbyDevices.tsx` props:

```tsx
export function NearbyDevices({
  peers,
  onSendFile,
  onSendFolder
}: {
  peers: AppStatus["peers"];
  onSendFile(deviceId: string): void;
  onSendFolder(deviceId: string): void;
}): JSX.Element {
```

Add a folder button next to the file button:

```tsx
            <button onClick={() => onSendFile(peer.deviceId)}>发送文件</button>
            <button onClick={() => onSendFolder(peer.deviceId)}>发送文件夹</button>
```

Modify `src/renderer/src/components/Transfers.tsx` props:

```tsx
export function Transfers({
  transfers,
  onCancel,
  onRetry
}: {
  transfers: AppStatus["transfers"];
  onCancel(id: string): void;
  onRetry(id: string): void;
}): JSX.Element {
```

Inside each transfer row, add:

```tsx
            {transfer.status === "active" ? <button onClick={() => onCancel(transfer.id)}>取消</button> : null}
            {transfer.status === "failed" ? <button onClick={() => onRetry(transfer.id)}>重试</button> : null}
```

Modify `App.tsx`:

```tsx
<NearbyDevices
  peers={status.peers}
  onSendFile={(deviceId) => api.sendFileToPeer(deviceId)}
  onSendFolder={(deviceId) => api.sendFolderToPeer(deviceId)}
/>
<Transfers
  transfers={status.transfers}
  onCancel={(id) => api.cancelTransfer(id)}
  onRetry={(id) => api.retryTransfer(id)}
/>
```

- [ ] **Step 7: Run checks and commit**

Run:

```powershell
npm run lint:types
npm run build
git add src/main src/renderer
git commit -m "feat: add folder transfer and transfer controls"
```

Expected: TypeScript, tests, and build pass.

## Task 13: Verification and Packaging

**Files:**
- Modify: `package.json`
- Create: `docs/manual-test-checklist.md`

- [ ] **Step 1: Add manual test checklist**

Create `docs/manual-test-checklist.md`:

```md
# Manual Test Checklist

## One Computer

- Start the app with `npm run dev`.
- Confirm the app window opens.
- Confirm the mobile URL appears.
- Open the mobile URL from the same computer.
- Confirm `/api/device` returns the local device identity.
- Choose a shared folder.
- Confirm the app shows the selected shared folder.

## Two Windows Computers

- Start the app on both computers on the same Wi-Fi or LAN.
- Confirm each computer appears in the other's nearby device list.
- Send a small file from A to B.
- Confirm B prompts for pairing.
- Accept pairing.
- Confirm the file appears in B's receive folder.
- Send another file from A to B.
- Confirm no repeated pairing prompt appears.
- Remove A from trusted devices on B.
- Send again.
- Confirm B asks for pairing again.

## Phone

- Open the desktop app.
- Scan the QR code with a phone on the same Wi-Fi.
- Confirm the phone page opens.
- Upload a photo from the phone.
- Confirm the file appears in the desktop receive folder.
- Browse the shared folder after pairing.
- Download a shared file.

## Failure Cases

- Block the app in Windows Firewall and confirm a clear connection failure is visible.
- Start another service on the app port and confirm the app selects a working port or reports the issue.
- Try to browse `../` from shared folder API and confirm the response is rejected.
- Remove the shared folder from disk and confirm the app prompts for a new folder.
- Transfer a large file and confirm progress changes until completion.
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run lint:types
npm run test
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Run the app locally**

Run:

```powershell
npm run dev
```

Expected: Electron app opens and shows the sidebar with Nearby Devices, Transfers, Shared Folder, and Mobile QR sections.

- [ ] **Step 4: Build Windows portable package**

Run:

```powershell
npm run dist:win
```

Expected: electron-builder creates a Windows portable artifact under `dist`.

- [ ] **Step 5: Commit verification docs**

Run:

```powershell
git add package.json docs/manual-test-checklist.md
git commit -m "docs: add manual verification checklist"
```

Expected: commit succeeds.

## Self-Review Notes

Spec coverage:

- Windows Electron desktop app: covered by Tasks 1, 5, 6, and 12.
- LAN auto-discovery: covered by Task 5.
- First-time pairing and trusted devices: covered by Tasks 2, 3, and 10.
- File and folder sending: file sending is covered by Task 11; folder sending is covered by Task 12.
- Shared folder browsing and download: covered by Tasks 3 and 7.
- Phone QR web access: covered by Task 8.
- Phone upload: covered by Task 9.
- Transfer progress, cancellation, failure, and retry: state model is covered by Task 4; desktop controls are covered by Task 12.
- Error handling: covered across Tasks 3, 4, 5, 7, 9, 10, 11, and 12.

Implementation risks:

- Windows Firewall behavior must be verified manually on real Windows machines.
- mDNS reliability varies by network; if discovery is unreliable, add a manual IP connection field in a follow-up plan.
- Phone browser upload uses the same `/api/upload` endpoint; if browser multipart payloads need richer file-name preservation, add multipart parsing after the raw end-to-end transfer path is verified.
