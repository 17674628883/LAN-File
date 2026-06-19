import fs from "node:fs/promises";
import http from "node:http";
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
const trustedDeviceId = "dev_trusted";
const untrustedDeviceId = "dev_untrusted";

describe("LAN shared folder endpoints", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await lanServer?.close();
    lanServer = undefined;
    await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })));
  });

  it("returns 404 JSON when no shared folder is configured", async () => {
    lanServer = await startTestServer();
    const accessToken = await pairTrustedDevice();

    const response = await fetch(`${lanServer.url}/api/shared/list`, { headers: bearerHeaders(accessToken) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Shared folder is not configured." });
  });

  it("pairs an already trusted device without prompting", async () => {
    const requestPairing = vi.fn();
    lanServer = await startTestServer(undefined, undefined, undefined, undefined, (deviceId) => deviceId === trustedDeviceId, requestPairing);

    const response = await fetch(`${lanServer.url}/api/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: trustedDeviceId, displayName: "Trusted Laptop", deviceType: "phone" })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ paired: true, accessToken: expect.any(String) });
    expect(requestPairing).not.toHaveBeenCalled();
  });

  it("rejects pairing requests without a device id", async () => {
    const requestPairing = vi.fn();
    lanServer = await startTestServer(undefined, undefined, undefined, undefined, undefined, requestPairing);

    const response = await fetch(`${lanServer.url}/api/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: "No Id" })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing device id." });
    expect(requestPairing).not.toHaveBeenCalled();
  });

  it("rejects an untrusted pairing request when pairing is denied", async () => {
    const requestPairing = vi.fn().mockResolvedValue(false);
    lanServer = await startTestServer(undefined, undefined, undefined, undefined, () => false, requestPairing);

    const response = await fetch(`${lanServer.url}/api/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: untrustedDeviceId, displayName: "Unknown Phone", deviceType: "phone" })
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ paired: false });
    expect(requestPairing).toHaveBeenCalledWith({
      deviceId: untrustedDeviceId,
      displayName: "Unknown Phone",
      deviceType: "phone"
    });
  });

  it("pairs an untrusted device when pairing is accepted and defaults device type to desktop", async () => {
    const requestPairing = vi.fn().mockResolvedValue(true);
    lanServer = await startTestServer(undefined, undefined, undefined, undefined, () => false, requestPairing);

    const response = await fetch(`${lanServer.url}/api/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: untrustedDeviceId, displayName: "Unknown Tablet", deviceType: "tablet" })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ paired: true, accessToken: expect.any(String) });
    expect(requestPairing).toHaveBeenCalledWith({
      deviceId: untrustedDeviceId,
      displayName: "Unknown Tablet",
      deviceType: "desktop"
    });
  });

  it("rejects shared folder lists when the access token is missing", async () => {
    const root = await createTempRoot();
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/list`);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Device is not paired." });
  });

  it("rejects shared folder lists when the access token is invalid", async () => {
    const root = await createTempRoot();
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/list`, { headers: bearerHeaders("invalid-token") });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Device is not paired." });
  });

  it("rejects shared folder lists when only a spoofed trusted device id header is present", async () => {
    const root = await createTempRoot();
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/list`, { headers: { "x-device-id": trustedDeviceId } });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Device is not paired." });
  });

  it("lists configured shared folder entries", async () => {
    const root = await createTempRoot();
    await fs.mkdir(path.join(root, "docs"));
    await fs.writeFile(path.join(root, "readme.txt"), "hello");
    lanServer = await startTestServer(() => root);
    const accessToken = await pairTrustedDevice();

    const response = await fetch(`${lanServer.url}/api/shared/list`, { headers: bearerHeaders(accessToken) });
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
    const accessToken = await pairTrustedDevice();

    const response = await fetch(`${lanServer.url}/api/shared/list?path=../secret`, { headers: bearerHeaders(accessToken) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Invalid shared folder path") });
  });

  it("does not expose local paths when shared folder listing fails", async () => {
    const root = await createTempRoot();
    await fs.rm(root, { recursive: true, force: true });
    lanServer = await startTestServer(() => root);
    const accessToken = await pairTrustedDevice();

    const response = await fetch(`${lanServer.url}/api/shared/list`, { headers: bearerHeaders(accessToken) });
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
    const accessToken = await pairTrustedDevice();

    const response = await fetch(
      `${lanServer.url}/api/shared/download?path=docs/readme.txt&accessToken=${encodeURIComponent(accessToken)}`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("filename=\"readme.txt\"");
    expect(await response.text()).toBe("hello");
  });

  it("rejects shared folder downloads when the access token is missing", async () => {
    const root = await createTempRoot();
    await fs.writeFile(path.join(root, "readme.txt"), "hello");
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/download?path=readme.txt`);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Device is not paired." });
  });

  it("rejects shared folder downloads when only a spoofed trusted device id header is present", async () => {
    const root = await createTempRoot();
    await fs.writeFile(path.join(root, "readme.txt"), "hello");
    lanServer = await startTestServer(() => root);

    const response = await fetch(`${lanServer.url}/api/shared/download?path=readme.txt`, {
      headers: { "x-device-id": trustedDeviceId }
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Device is not paired." });
  });

  it("does not expose local paths when resolving a shared folder download fails", async () => {
    const root = await createTempRoot();
    await fs.rm(root, { recursive: true, force: true });
    lanServer = await startTestServer(() => root);
    const accessToken = await pairTrustedDevice();

    const response = await fetch(`${lanServer.url}/api/shared/download?path=missing.txt`, { headers: bearerHeaders(accessToken) });
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
    const accessToken = await pairTrustedDevice();

    const response = await fetch(`${lanServer.url}/api/shared/download?path=readme.txt`, { headers: bearerHeaders(accessToken) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Unable to download shared file." });
    expect(body.error).not.toContain(root);
  });

  it("returns 500 JSON when no receive folder is configured", async () => {
    lanServer = await startTestServer();

    const response = await fetch(`${lanServer.url}/api/upload`, {
      method: "POST",
      body: "hello"
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Receive folder is not configured." });
  });

  it("streams uploads to the configured receive folder", async () => {
    const receiveRoot = path.join(await createTempRoot(), "received");
    lanServer = await startTestServer(undefined, undefined, () => receiveRoot);

    const response = await fetch(`${lanServer.url}/api/upload`, {
      method: "POST",
      body: "hello from mobile"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, savedAs: expect.stringMatching(/\.upload$/) });
    await expect(fs.readFile(path.join(receiveRoot, body.savedAs), "utf8")).resolves.toBe("hello from mobile");
  });

  it("preserves safe relative upload paths from x-file-name", async () => {
    const receiveRoot = path.join(await createTempRoot(), "received");
    lanServer = await startTestServer(undefined, undefined, () => receiveRoot);

    const response = await fetch(`${lanServer.url}/api/upload`, {
      method: "POST",
      headers: { "x-file-name": encodeURIComponent("docs/readme.txt") },
      body: "folder file"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, savedAs: "docs/readme.txt" });
    await expect(fs.readFile(path.join(receiveRoot, "docs", "readme.txt"), "utf8")).resolves.toBe("folder file");
  });

  it("rejects upload file names that escape the receive folder", async () => {
    const tempRoot = await createTempRoot();
    const receiveRoot = path.join(tempRoot, "received");
    lanServer = await startTestServer(undefined, undefined, () => receiveRoot);

    const response = await fetch(`${lanServer.url}/api/upload`, {
      method: "POST",
      headers: { "x-file-name": encodeURIComponent("../outside.txt") },
      body: "nope"
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid upload file name." });
    await expect(fs.stat(path.join(tempRoot, "outside.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects uploads with content-length above the configured maximum before creating a file", async () => {
    const receiveRoot = path.join(await createTempRoot(), "received");
    lanServer = await startTestServer(undefined, undefined, () => receiveRoot, 5);

    const response = await fetch(`${lanServer.url}/api/upload`, {
      method: "POST",
      headers: { "content-length": "6" },
      body: "123456"
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Upload is too large." });
    await expect(fs.stat(receiveRoot)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects chunked uploads that stream beyond the configured maximum and removes partial files", async () => {
    const receiveRoot = path.join(await createTempRoot(), "received");
    lanServer = await startTestServer(undefined, undefined, () => receiveRoot, 5);

    const response = await postChunkedUpload(lanServer.url, ["123", "456"]);

    expect(response.status).toBe(413);
    expect(JSON.parse(response.body)).toEqual({ error: "Upload is too large." });
    await expect(fs.readdir(receiveRoot)).resolves.toEqual([]);
  });

  it("serves built mobile app assets when they are available", async () => {
    const mobileRoot = await createTempRoot();
    await fs.mkdir(path.join(mobileRoot, "assets"));
    await fs.writeFile(
      path.join(mobileRoot, "index.html"),
      '<!doctype html><div id="root"></div><script type="module" src="/mobile/assets/app.js"></script>'
    );
    await fs.writeFile(path.join(mobileRoot, "assets", "app.js"), 'document.body.dataset.mobile = "ready";');
    lanServer = await startTestServer(undefined, mobileRoot);

    const pageResponse = await fetch(`${lanServer.url}/mobile`);
    const assetResponse = await fetch(`${lanServer.url}/mobile/assets/app.js`);

    expect(pageResponse.status).toBe(200);
    expect(pageResponse.headers.get("content-type")).toContain("text/html");
    expect(await pageResponse.text()).toContain("/mobile/assets/app.js");
    expect(assetResponse.status).toBe(200);
    expect(await assetResponse.text()).toContain("dataset.mobile");
  });
});

async function startTestServer(
  getSharedFolder?: () => string | undefined,
  mobileAssetsPath?: string,
  getReceiveFolder?: () => string,
  maxUploadBytes?: number,
  isTrusted: (deviceId: string) => boolean = (deviceId) => deviceId === trustedDeviceId,
  requestPairing?: (remote: { deviceId: string; displayName: string; deviceType: "desktop" | "phone" }) => Promise<boolean>
): Promise<LanServer> {
  return startLanServer({
    identity,
    host: "127.0.0.1",
    preferredPort: 0,
    getSharedFolder,
    getReceiveFolder,
    mobileAssetsPath,
    maxUploadBytes,
    isTrusted,
    requestPairing
  });
}

async function pairTrustedDevice(deviceId: string = trustedDeviceId): Promise<string> {
  if (!lanServer) {
    throw new Error("LAN server is not running.");
  }

  const response = await fetch(`${lanServer.url}/api/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId, displayName: "Trusted Phone", deviceType: "phone" })
  });
  const body = (await response.json()) as { accessToken?: string };

  expect(response.status).toBe(200);
  expect(body.accessToken).toEqual(expect.any(String));
  return body.accessToken ?? "";
}

function bearerHeaders(accessToken: string): HeadersInit {
  return { authorization: `Bearer ${accessToken}` };
}

async function postChunkedUpload(serverUrl: string, chunks: string[]): Promise<{ status: number; body: string }> {
  const url = new URL("/api/upload", serverUrl);

  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: "POST",
        headers: { "transfer-encoding": "chunked" }
      },
      (response) => {
        response.setEncoding("utf8");
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({ status: response.statusCode ?? 0, body });
        });
      }
    );

    request.on("error", reject);

    for (const chunk of chunks) {
      request.write(chunk);
    }

    request.end();
  });
}

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lan-server-shared-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}
