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
import { chooseReceivedPath } from "./receivedFiles";
import { listSharedFolder } from "./sharedFolder";

const SHUTDOWN_TIMEOUT_MS = 1_000;
const BUILT_MOBILE_INDEX = "index.html";
const FETCH_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104,
  109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526,
  530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 666, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659,
  4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080
]);
export const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export interface StartLanServerOptions {
  identity: DeviceIdentity;
  host: string;
  preferredPort: number;
  getSharedFolder?: () => string | undefined;
  getReceiveFolder?: () => string;
  isTrusted?: (deviceId: string) => boolean;
  requestPairing?: (remote: { deviceId: string; displayName: string; deviceType: "desktop" | "phone" }) => Promise<boolean>;
  onUploadCompleted?: (file: { relativePath: string; absolutePath: string; size: number }) => void | Promise<void>;
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
  onUploadCompleted,
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
    let uploadCreated = false;

    try {
      await fs.promises.mkdir(receiveFolder, { recursive: true });
      const resolvedUploadTarget = resolveUploadTarget(receiveFolder, request.get("x-file-name"));
      await validateUploadParent(receiveFolder, path.dirname(resolvedUploadTarget.absolutePath));
      const uploadTarget = await chooseReceivedPath(receiveFolder, resolvedUploadTarget.relativePath);
      filePath = uploadTarget.absolutePath;
      await validateUploadParent(receiveFolder, path.dirname(uploadTarget.absolutePath));

      const bytesWritten = await writeUploadToFile(request, filePath, maxUploadBytes, () => {
        uploadCreated = true;
      });

      await notifyUploadCompleted(onUploadCompleted, {
        relativePath: uploadTarget.relativePath,
        absolutePath: uploadTarget.absolutePath,
        size: bytesWritten
      });

      response.json({ ok: true, savedAs: uploadTarget.relativePath });
    } catch (error: unknown) {
      if (!(error instanceof UploadTooLargeError) && !(error instanceof InvalidUploadFileNameError)) {
        console.error("Upload failed.", error);
      }

      if (filePath && uploadCreated) {
        await fs.promises.rm(filePath, { force: true }).catch((cleanupError: unknown) => {
          console.error("Failed to remove partial upload.", cleanupError);
        });
      }

      if (!response.headersSent) {
        if (error instanceof UploadTooLargeError) {
          response.status(413).json({ error: "Upload is too large." });
          return;
        }

        if (error instanceof InvalidUploadFileNameError) {
          response.status(400).json({ error: "Invalid upload file name." });
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

class InvalidUploadFileNameError extends Error {
  constructor() {
    super("Invalid upload file name.");
    this.name = "InvalidUploadFileNameError";
  }
}

function parsePairingRequest(body: unknown): { deviceId: string; displayName: string; deviceType: "desktop" | "phone" } {
  const values = isObjectRecord(body) ? body : {};
  const deviceId = typeof values.deviceId === "string" ? values.deviceId : "";
  const displayName = typeof values.displayName === "string" ? values.displayName : "";
  const deviceType = values.deviceType === "phone" ? "phone" : "desktop";

  return { deviceId, displayName, deviceType };
}

function resolveUploadTarget(receiveFolder: string, encodedFileName: string | undefined): { absolutePath: string; relativePath: string } {
  if (!encodedFileName) {
    const fileName = `${Date.now()}-${randomUUID()}.upload`;
    return { absolutePath: path.join(receiveFolder, fileName), relativePath: fileName };
  }

  const decodedFileName = decodeUploadFileName(encodedFileName);
  const normalizedFileName = decodedFileName.replace(/\\/g, "/");

  if (
    normalizedFileName.includes("\0") ||
    path.posix.isAbsolute(normalizedFileName) ||
    path.win32.isAbsolute(decodedFileName)
  ) {
    throw new InvalidUploadFileNameError();
  }

  const segments = normalizedFileName.split("/");

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "" || segment === "." || segment === ".." || /^[a-zA-Z]:$/.test(segment))
  ) {
    throw new InvalidUploadFileNameError();
  }

  const absolutePath = path.resolve(receiveFolder, ...segments);
  const receiveRoot = path.resolve(receiveFolder);
  const relativeToRoot = path.relative(receiveRoot, absolutePath);

  if (relativeToRoot === "" || relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new InvalidUploadFileNameError();
  }

  return { absolutePath, relativePath: segments.join("/") };
}

function decodeUploadFileName(encodedFileName: string): string {
  try {
    return decodeURIComponent(encodedFileName);
  } catch {
    return encodedFileName;
  }
}

async function notifyUploadCompleted(
  onUploadCompleted: StartLanServerOptions["onUploadCompleted"],
  file: { relativePath: string; absolutePath: string; size: number }
): Promise<void> {
  try {
    await onUploadCompleted?.(file);
  } catch (error: unknown) {
    console.error("Upload completed, but completion observer failed.", error);
  }
}

async function validateUploadParent(receiveFolder: string, targetParent: string): Promise<void> {
  const receiveRoot = path.resolve(receiveFolder);
  const resolvedTargetParent = path.resolve(targetParent);
  const relativeParent = path.relative(receiveRoot, resolvedTargetParent);

  if (relativeParent === "" || relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) {
    return;
  }

  const receiveRootRealPath = await fs.promises.realpath(receiveRoot);
  assertPathInsideRoot(receiveRootRealPath, receiveRootRealPath);

  let currentPath = receiveRoot;

  for (const segment of relativeParent.split(path.sep)) {
    currentPath = path.join(currentPath, segment);

    try {
      const currentRealPath = await fs.promises.realpath(currentPath);
      assertPathInsideRoot(receiveRootRealPath, currentRealPath);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  }
}

function assertPathInsideRoot(rootRealPath: string, candidateRealPath: string): void {
  const relativePath = path.relative(rootRealPath, candidateRealPath);

  if (relativePath !== "" && (relativePath.startsWith("..") || path.isAbsolute(relativePath))) {
    throw new InvalidUploadFileNameError();
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
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

function writeUploadToFile(
  request: express.Request,
  filePath: string,
  maxUploadBytes: number,
  onCreated: () => void
): Promise<number> {
  return fs.promises.open(filePath, "wx").then((fileHandle) => {
    onCreated();

    return new Promise<number>((resolve, reject) => {
      const writeStream = fileHandle.createWriteStream({ autoClose: true });
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

        resolve(bytesReceived);
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

async function listen(server: http.Server, preferredPort: number): Promise<number> {
  try {
    return await attemptListen(server, preferredPort);
  } catch (error: unknown) {
    if (!isRetryableListenError(error)) {
      throw error;
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await attemptListen(server, 0);
    } catch (error: unknown) {
      if (!isRetryableListenError(error) || attempt === 9) {
        throw error;
      }
    }
  }

  throw new Error("Unable to find an available LAN server port.");
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

      if (FETCH_BLOCKED_PORTS.has(address.port)) {
        server.close(() => {
          const error = new Error(`Port ${address.port} is blocked by browser fetch clients.`) as NodeJS.ErrnoException;
          error.code = "EADDRINUSE";
          reject(error);
        });
        return;
      }

      resolve(address.port);
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "0.0.0.0");
  });
}

function isRetryableListenError(error: unknown): error is NodeJS.ErrnoException {
  return isNodeError(error) && (error.code === "EADDRINUSE" || error.code === "EACCES");
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
