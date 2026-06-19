import express from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import type { DeviceIdentity } from "./deviceIdentity";
import { resolveSharedRealPath } from "./pathSafety";
import { listSharedFolder } from "./sharedFolder";

const SHUTDOWN_TIMEOUT_MS = 1_000;
const BUILT_MOBILE_INDEX = "index.html";
export const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export interface StartLanServerOptions {
  identity: DeviceIdentity;
  host: string;
  preferredPort: number;
  getSharedFolder?: () => string | undefined;
  getReceiveFolder?: () => string;
  isTrusted?: (deviceId: string) => boolean;
  requestPairing?: (remote: { deviceId: string; displayName: string; deviceType: "desktop" | "phone" }) => Promise<boolean>;
  maxUploadBytes?: number;
  mobileAssetsPath?: string;
}

export interface LanServer {
  port: number;
  url: string;
  close(): Promise<void>;
}

export async function startLanServer({
  identity,
  host,
  preferredPort,
  getSharedFolder,
  getReceiveFolder,
  isTrusted,
  requestPairing,
  maxUploadBytes = DEFAULT_MAX_UPLOAD_BYTES,
  mobileAssetsPath
}: StartLanServerOptions): Promise<LanServer> {
  const app = express();
  const server = http.createServer(app);
  const webSocketServer = new WebSocketServer({ server });
  const resolvedMobileAssetsPath = mobileAssetsPath ?? getDefaultMobileAssetsPath();
  const deviceAccessTokens = new Map<string, string>();
  const accessTokenDeviceIds = new Map<string, string>();

  app.get("/api/device", (_request, response) => {
    response.json({
      deviceId: identity.deviceId,
      displayName: identity.displayName,
      deviceType: "desktop"
    });
  });

  app.post("/api/pair", express.json(), async (request, response) => {
    const remote = parsePairingRequest(request.body);

    if (!remote.deviceId) {
      response.status(400).json({ error: "Missing device id." });
      return;
    }

    if (isTrusted?.(remote.deviceId)) {
      response.json({ paired: true, accessToken: issueAccessToken(remote.deviceId, deviceAccessTokens, accessTokenDeviceIds) });
      return;
    }

    const accepted = await resolvePairingRequest(remote, requestPairing);
    if (accepted) {
      response.json({ paired: true, accessToken: issueAccessToken(remote.deviceId, deviceAccessTokens, accessTokenDeviceIds) });
      return;
    }

    response.status(403).json({ paired: false });
  });

  app.get("/api/shared/list", async (request, response) => {
    if (!isSharedRequestAuthorized(request, isTrusted, accessTokenDeviceIds)) {
      response.status(403).json({ error: "Device is not paired." });
      return;
    }

    const sharedFolder = getSharedFolder?.();

    if (!sharedFolder) {
      response.status(404).json({ error: "Shared folder is not configured." });
      return;
    }

    try {
      const entries = await listSharedFolder(sharedFolder, getRequestedPath(request.query.path));
      response.json({ entries });
    } catch (error: unknown) {
      response.status(400).json({ error: getPublicErrorMessage(error, "Unable to list shared folder.") });
    }
  });

  app.get("/api/shared/download", async (request, response) => {
    if (!isSharedRequestAuthorized(request, isTrusted, accessTokenDeviceIds)) {
      response.status(403).json({ error: "Device is not paired." });
      return;
    }

    const sharedFolder = getSharedFolder?.();

    if (!sharedFolder) {
      response.status(404).json({ error: "Shared folder is not configured." });
      return;
    }

    try {
      const requestedPath = getRequestedPath(request.query.path);
      const filePath = await resolveDownloadPath(sharedFolder, requestedPath);
      response.download(filePath, path.basename(filePath), (error: Error | undefined) => {
        if (!error) {
          return;
        }

        console.error("Unable to download shared file.", error);

        if (!response.headersSent) {
          response.status(500).json({ error: "Unable to download shared file." });
          return;
        }

        if (!response.destroyed) {
          response.destroy(error);
        }
      });
    } catch (error: unknown) {
      response.status(400).json({ error: getPublicErrorMessage(error, "Unable to download shared file.") });
    }
  });

  app.post("/api/upload", async (request, response) => {
    if (isContentLengthOverLimit(request, maxUploadBytes)) {
      response.status(413).json({ error: "Upload is too large." });
      return;
    }

    const receiveFolder = getReceiveFolder?.();

    if (!receiveFolder) {
      response.status(500).json({ error: "Receive folder is not configured." });
      return;
    }

    let filePath: string | undefined;

    try {
      await fs.promises.mkdir(receiveFolder, { recursive: true });
      const fileName = `${Date.now()}-${randomUUID()}.upload`;
      filePath = path.join(receiveFolder, fileName);

      await writeUploadToFile(request, filePath, maxUploadBytes);

      response.json({ ok: true, savedAs: fileName });
    } catch (error: unknown) {
      if (!(error instanceof UploadTooLargeError)) {
        console.error("Upload failed.", error);
      }

      if (filePath) {
        await fs.promises.rm(filePath, { force: true }).catch((cleanupError: unknown) => {
          console.error("Failed to remove partial upload.", cleanupError);
        });
      }

      if (!response.headersSent) {
        if (error instanceof UploadTooLargeError) {
          response.status(413).json({ error: "Upload is too large." });
          return;
        }

        response.status(500).json({ error: "Upload failed." });
        return;
      }

      if (!response.destroyed) {
        response.destroy(error instanceof Error ? error : new Error("Upload failed."));
      }
    }
  });

  app.get(["/mobile", "/mobile/"], (_request, response) => {
    sendMobileEntry(response, resolvedMobileAssetsPath);
  });
  app.use("/mobile", express.static(resolvedMobileAssetsPath, { index: false }));

  webSocketServer.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        type: "hello",
        deviceId: identity.deviceId
      })
    );
  });

  const port = await listen(server, preferredPort);

  return {
    port,
    url: `http://${host}:${port}`,
    close: () => closeServer(server, webSocketServer)
  };
}

class UploadTooLargeError extends Error {
  constructor() {
    super("Upload is too large.");
    this.name = "UploadTooLargeError";
  }
}

function parsePairingRequest(body: unknown): { deviceId: string; displayName: string; deviceType: "desktop" | "phone" } {
  const values = isObjectRecord(body) ? body : {};
  const deviceId = typeof values.deviceId === "string" ? values.deviceId : "";
  const displayName = typeof values.displayName === "string" ? values.displayName : "";
  const deviceType = values.deviceType === "phone" ? "phone" : "desktop";

  return { deviceId, displayName, deviceType };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function issueAccessToken(deviceId: string, deviceAccessTokens: Map<string, string>, accessTokenDeviceIds: Map<string, string>): string {
  const existingToken = deviceAccessTokens.get(deviceId);

  if (existingToken) {
    return existingToken;
  }

  const accessToken = randomBytes(32).toString("base64url");
  deviceAccessTokens.set(deviceId, accessToken);
  accessTokenDeviceIds.set(accessToken, deviceId);
  return accessToken;
}

function isSharedRequestAuthorized(
  request: express.Request,
  isTrusted: StartLanServerOptions["isTrusted"],
  accessTokenDeviceIds: Map<string, string>
): boolean {
  const accessToken = getRequestAccessToken(request);

  if (!accessToken) {
    return false;
  }

  const deviceId = accessTokenDeviceIds.get(accessToken);
  return typeof deviceId === "string" && isTrusted?.(deviceId) === true;
}

function getRequestAccessToken(request: express.Request): string {
  const authorization = request.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }

  return getSingleQueryValue(request.query.accessToken);
}

async function resolvePairingRequest(
  remote: { deviceId: string; displayName: string; deviceType: "desktop" | "phone" },
  requestPairing: StartLanServerOptions["requestPairing"]
): Promise<boolean> {
  try {
    return (await requestPairing?.(remote)) === true;
  } catch {
    return false;
  }
}

function isContentLengthOverLimit(request: express.Request, maxUploadBytes: number): boolean {
  const contentLength = request.get("content-length");

  if (!contentLength) {
    return false;
  }

  const byteLength = Number(contentLength);
  return Number.isFinite(byteLength) && byteLength > maxUploadBytes;
}

function writeUploadToFile(request: express.Request, filePath: string, maxUploadBytes: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath, { flags: "wx" });
    let bytesReceived = 0;
    let settled = false;

    const cleanup = (): void => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onRequestError);
      writeStream.off("finish", onFinish);
      writeStream.off("error", onWriteError);
    };

    const settle = (error?: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();

      if (error) {
        writeStream.destroy();
        reject(error);
        return;
      }

      resolve();
    };

    const onData = (chunk: Buffer): void => {
      bytesReceived += chunk.length;

      if (bytesReceived > maxUploadBytes) {
        request.pause();
        settle(new UploadTooLargeError());
        request.resume();
        return;
      }

      if (!writeStream.write(chunk)) {
        request.pause();
        writeStream.once("drain", () => {
          if (!settled) {
            request.resume();
          }
        });
      }
    };

    const onEnd = (): void => {
      if (!settled) {
        writeStream.end();
      }
    };

    const onRequestError = (error: Error): void => {
      settle(error);
    };

    const onWriteError = (error: Error): void => {
      settle(error);
    };

    const onFinish = (): void => {
      settle();
    };

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onRequestError);
    writeStream.on("finish", onFinish);
    writeStream.on("error", onWriteError);
  });
}

function getDefaultMobileAssetsPath(): string {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [
    path.resolve(currentDirectory, "../mobile"),
    path.resolve(currentDirectory, "../../mobile")
  ];

  return candidatePaths.find(hasBuiltMobileEntry) ?? candidatePaths[0];
}

function hasBuiltMobileEntry(directory: string): boolean {
  try {
    return fs.statSync(path.join(directory, BUILT_MOBILE_INDEX)).isFile();
  } catch {
    return false;
  }
}

function sendMobileEntry(response: express.Response, mobileAssetsPath: string): void {
  if (hasBuiltMobileEntry(mobileAssetsPath)) {
    response.sendFile(path.join(mobileAssetsPath, BUILT_MOBILE_INDEX));
    return;
  }

  response.type("html").send(getMobileFallbackHtml());
}

function getMobileFallbackHtml(): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>手机快传</title>
  </head>
  <body>
    <main>
      <h1>手机快传</h1>
      <form action="/api/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="files" multiple>
        <button type="submit">上传到电脑</button>
      </form>
      <h2>共享文件夹</h2>
    </main>
  </body>
</html>`;
}

async function resolveDownloadPath(sharedFolder: string, requestedPath: string): Promise<string> {
  const result = await resolveSharedRealPath(sharedFolder, requestedPath);

  if (!result.ok) {
    throw new Error(`Invalid shared folder path: ${result.reason}`);
  }

  const stats = await fs.promises.stat(result.path);

  if (!stats.isFile()) {
    throw new Error("Invalid shared folder path: Requested path is not a file.");
  }

  return result.path;
}

function getRequestedPath(value: unknown): string {
  return getSingleQueryValue(value);
}

function getSingleQueryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }

  return typeof value === "string" ? value : "";
}

function getPublicErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.startsWith("Invalid shared folder path")) {
    return error.message;
  }

  return fallback;
}

function listen(server: http.Server, preferredPort: number): Promise<number> {
  return attemptListen(server, preferredPort).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" || error.code === "EACCES") {
      return attemptListen(server, 0);
    }

    throw error;
  });
}

function attemptListen(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.off("listening", onListening);
      reject(error);
    };

    const onListening = (): void => {
      server.off("error", onError);
      const address = server.address() as AddressInfo;
      resolve(address.port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "0.0.0.0");
  });
}

function closeServer(server: http.Server, webSocketServer: WebSocketServer): Promise<void> {
  for (const client of webSocketServer.clients) {
    client.terminate();
  }

  return closeWebSocketServer(webSocketServer).then(() => closeHttpServer(server));
}

function closeWebSocketServer(webSocketServer: WebSocketServer): Promise<void> {
  return withTimeout(
    new Promise((resolve, reject) => {
      webSocketServer.close((webSocketError) => {
        if (webSocketError) {
          reject(webSocketError);
          return;
        }

        resolve();
      });
    }),
    SHUTDOWN_TIMEOUT_MS
  );
}

function closeHttpServer(server: http.Server): Promise<void> {
  return withTimeout(
    new Promise((resolve, reject) => {
      server.close((serverError) => {
        if (serverError) {
          reject(serverError);
          return;
        }

        resolve();
      });
    }),
    SHUTDOWN_TIMEOUT_MS
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => {
        clearTimeout(timeout);
      });
  });
}
