import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startLanServer, type LanServer } from "../../src/main/core/lanServer";

const tempRoots: string[] = [];
let lanServer: LanServer | undefined;

const identity = {
  deviceId: "dev_123e4567-e89b-42d3-a456-426614174000",
  secret: `sec_${"a".repeat(64)}`,
  displayName: "Test Device",
  createdAt: 1
};

describe("LAN shared folder endpoints", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await lanServer?.close();
    lanServer = undefined;
    await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })));
  });

  it("returns 404 JSON when no shared folder is configured", async () => {
    lanServer = await startTestServer();

    const response = await fetch(`${lanServer.url}/api/shared/list`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Shared folder is not configured." });
  });

  it("lists configured shared folder entries", async () => {
    const root = await createTempRoot();
    await fs.mkdir(path.join(root, "docs"));
    await fs.writeFile(path.join(root, "readme.txt"), "hello");
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/list`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries).toMatchObject([
      { name: "docs", relativePath: "docs", type: "directory" },
      { name: "readme.txt", relativePath: "readme.txt", type: "file", size: 5 }
    ]);
  });

  it("rejects invalid shared folder list paths", async () => {
    const root = await createTempRoot();
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/list?path=../secret`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Invalid shared folder path") });
  });

  it("does not expose local paths when shared folder listing fails", async () => {
    const root = await createTempRoot();
    await fs.rm(root, { recursive: true, force: true });
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/list`);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Unable to list shared folder." });
    expect(body.error).not.toContain(root);
  });

  it("downloads a configured shared folder file using its basename", async () => {
    const root = await createTempRoot();
    await fs.mkdir(path.join(root, "docs"));
    await fs.writeFile(path.join(root, "docs", "readme.txt"), "hello");
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/download?path=docs/readme.txt`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("filename=\"readme.txt\"");
    expect(await response.text()).toBe("hello");
  });

  it("does not expose local paths when resolving a shared folder download fails", async () => {
    const root = await createTempRoot();
    await fs.rm(root, { recursive: true, force: true });
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/download?path=missing.txt`);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Unable to download shared file." });
    expect(body.error).not.toContain(root);
  });

  it("does not expose local paths when the download stream fails before headers are sent", async () => {
    const root = await createTempRoot();
    const filePath = path.join(root, "readme.txt");
    await fs.writeFile(filePath, "hello");
    vi.spyOn(express.response, "download").mockImplementation(function downloadWithError(
      this: express.Response,
      _path: string,
      filenameOrCallback?: string | ((error: Error) => void),
      callback?: (error: Error) => void
    ) {
      const downloadCallback = typeof filenameOrCallback === "function" ? filenameOrCallback : callback;
      downloadCallback?.(new Error(`Unable to read ${filePath}`));
    } as typeof express.response.download);
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/download?path=readme.txt`);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Unable to download shared file." });
    expect(body.error).not.toContain(root);
  });
});

async function startTestServer(getSharedFolder?: () => string | undefined): Promise<LanServer> {
  return startLanServer({
    identity,
    host: "127.0.0.1",
    preferredPort: 0,
    getSharedFolder
  });
}

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lan-server-shared-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}
