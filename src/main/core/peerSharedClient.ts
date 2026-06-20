import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FileBrowserEntry } from "../../shared/fileBrowserTypes";
import type { PairingPeer } from "./pairingClient";
import { chooseReceivedPath } from "./receivedFiles";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface PeerSharedClient {
  list(peer: PairingPeer, relativePath: string): Promise<FileBrowserEntry[]>;
  download(peer: PairingPeer, relativePath: string, receiveRoot: string): Promise<string>;
}

export function createPeerSharedClient(options: {
  fetchImpl?: FetchLike;
  getAccessToken(peer: PairingPeer): Promise<string>;
}): PeerSharedClient {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async list(peer, relativePath) {
      const response = await fetchImpl(createPeerSharedUrl(peer, "/api/shared/list", relativePath), {
        headers: { authorization: `Bearer ${await options.getAccessToken(peer)}` }
      });

      if (!response.ok) {
        throw new Error(`Unable to list peer shared files: ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as { entries?: FileBrowserEntry[] };
      return body.entries ?? [];
    },

    async download(peer, relativePath, receiveRoot) {
      const response = await fetchImpl(createPeerSharedUrl(peer, "/api/shared/download", relativePath), {
        headers: { authorization: `Bearer ${await options.getAccessToken(peer)}` }
      });

      if (!response.ok || !response.body) {
        throw new Error(`Unable to download peer shared file: ${response.status} ${response.statusText}`);
      }

      await validateReceiveRelativeParent(receiveRoot, relativePath);
      const target = await chooseReceivedPath(receiveRoot, relativePath);
      await validateReceiveParentInsideRoot(receiveRoot, path.dirname(target.absolutePath));
      await writeResponseBody(response, target.absolutePath);
      return target.absolutePath;
    }
  };
}

function createPeerSharedUrl(peer: PairingPeer, pathname: string, relativePath: string): string {
  const url = new URL(pathname, `http://${formatHostForUrl(peer.host)}:${peer.port}`);
  if (relativePath) {
    url.searchParams.set("path", relativePath);
  }
  return url.toString();
}

async function writeResponseBody(response: Response, filePath: string): Promise<void> {
  if (!response.body) {
    throw new Error("Peer download response did not include a body.");
  }

  await pipeline(Readable.from(response.body), fs.createWriteStream(filePath, { flags: "wx" }));
}

async function validateReceiveRelativeParent(receiveRoot: string, relativePath: string): Promise<void> {
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  const relativeDirectory = path.posix.dirname(normalizedRelativePath);

  if (relativeDirectory === ".") {
    return;
  }

  const receiveRootRealPath = await fs.promises.realpath(receiveRoot);
  let currentPath = receiveRoot;

  for (const segment of relativeDirectory.split("/")) {
    currentPath = path.join(currentPath, segment);

    try {
      await validateReceiveParentInsideRootWithRealRoot(receiveRootRealPath, currentPath);
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return;
      }

      throw error;
    }
  }
}

async function validateReceiveParentInsideRoot(receiveRoot: string, targetParent: string): Promise<void> {
  const receiveRootRealPath = await fs.promises.realpath(receiveRoot);
  await validateReceiveParentInsideRootWithRealRoot(receiveRootRealPath, targetParent);
}

async function validateReceiveParentInsideRootWithRealRoot(receiveRootRealPath: string, targetParent: string): Promise<void> {
  const targetParentRealPath = await fs.promises.realpath(targetParent);
  const relativePath = path.relative(receiveRootRealPath, targetParentRealPath);

  if (relativePath !== "" && (relativePath.startsWith("..") || path.isAbsolute(relativePath))) {
    throw new Error("Invalid peer download path.");
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatHostForUrl(host: string): string {
  if (host.includes(":") && !host.startsWith("[") && !host.endsWith("]")) {
    return `[${host}]`;
  }

  return host;
}
