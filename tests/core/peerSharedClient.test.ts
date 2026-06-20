import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPeerSharedClient } from "../../src/main/core/peerSharedClient";

const tempRoots: string[] = [];

describe("peer shared client", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((tempRoot) => fs.rm(tempRoot, { recursive: true, force: true })));
  });

  it("lists an authenticated peer directory", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entries: [] }), { status: 200 }));
    const client = createPeerSharedClient({ fetchImpl, getAccessToken: async () => "token" });

    await client.list({ host: "192.168.1.20", port: 43670, deviceId: "peer", name: "Office PC" }, "Photos");

    expect(fetchImpl).toHaveBeenCalledWith("http://192.168.1.20:43670/api/shared/list?path=Photos", {
      headers: { authorization: "Bearer token" }
    });
  });

  it("downloads into the receive folder with a conflict-safe name", async () => {
    const receiveRoot = await createTempRoot();
    await fs.writeFile(path.join(receiveRoot, "Photo.jpg"), "old");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("new", { status: 200 }));
    const client = createPeerSharedClient({ fetchImpl, getAccessToken: async () => "token" });

    const savedPath = await client.download(
      { host: "192.168.1.20", port: 43670, deviceId: "peer", name: "Office PC" },
      "Photo.jpg",
      receiveRoot
    );

    expect(savedPath).toBe(path.join(receiveRoot, "Photo (1).jpg"));
    await expect(fs.readFile(savedPath, "utf8")).resolves.toBe("new");
  });

  it("rejects downloads through linked receive directories that escape the receive folder", async () => {
    const tempRoot = await createTempRoot();
    const receiveRoot = path.join(tempRoot, "received");
    const outsideRoot = path.join(tempRoot, "outside");
    await fs.mkdir(receiveRoot, { recursive: true });
    await fs.mkdir(outsideRoot, { recursive: true });
    await fs.symlink(outsideRoot, path.join(receiveRoot, "linked"), process.platform === "win32" ? "junction" : "dir");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 200 }));
    const client = createPeerSharedClient({ fetchImpl, getAccessToken: async () => "token" });

    await expect(
      client.download({ host: "192.168.1.20", port: 43670, deviceId: "peer", name: "Office PC" }, "linked/escaped.txt", receiveRoot)
    ).rejects.toThrow("Invalid peer download path.");
    await expect(fs.stat(path.join(outsideRoot, "escaped.txt"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not create nested directories through linked receive directories", async () => {
    const tempRoot = await createTempRoot();
    const receiveRoot = path.join(tempRoot, "received");
    const outsideRoot = path.join(tempRoot, "outside");
    await fs.mkdir(receiveRoot, { recursive: true });
    await fs.mkdir(outsideRoot, { recursive: true });
    await fs.symlink(outsideRoot, path.join(receiveRoot, "linked"), process.platform === "win32" ? "junction" : "dir");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 200 }));
    const client = createPeerSharedClient({ fetchImpl, getAccessToken: async () => "token" });

    await expect(
      client.download(
        { host: "192.168.1.20", port: 43670, deviceId: "peer", name: "Office PC" },
        "linked/newdir/escaped.txt",
        receiveRoot
      )
    ).rejects.toThrow("Invalid peer download path.");
    await expect(fs.stat(path.join(outsideRoot, "newdir"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function createTempRoot(): Promise<string> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lan-peer-shared-"));
  tempRoots.push(tempRoot);
  return tempRoot;
}
