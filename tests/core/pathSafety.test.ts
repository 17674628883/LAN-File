import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveSharedPath, resolveSharedRealPath } from "../../src/main/core/pathSafety";

describe("shared folder path safety", () => {
  it("resolves a normal child path inside the shared root", () => {
    const result = resolveSharedPath("C:/Shared", "folder/file.txt");

    expect(result).toEqual({
      ok: true,
      path: path.win32.resolve("C:/Shared/folder/file.txt")
    });
  });

  it("rejects parent traversal", () => {
    const result = resolveSharedPath("C:/Shared", "../secret.txt");

    expect(result.ok).toBe(false);
  });

  it("rejects an absolute path outside the shared root", () => {
    const result = resolveSharedPath("C:/Shared", "C:/Users/Alice/secret.txt");

    expect(result.ok).toBe(false);
  });

  it("rejects sibling paths that only share the root string prefix", () => {
    const result = resolveSharedPath("C:/Shared", "C:/Shared-Evil/file.txt");

    expect(result.ok).toBe(false);
  });

  it("handles mixed Windows separators for child paths", () => {
    const result = resolveSharedPath("C:/Shared", "folder\\nested/file.txt");

    expect(result).toEqual({
      ok: true,
      path: path.win32.resolve("C:/Shared/folder/nested/file.txt")
    });
  });

  it("allows child paths from a drive root", () => {
    const result = resolveSharedPath("C:/", "file.txt");

    expect(result).toEqual({
      ok: true,
      path: path.win32.resolve("C:/file.txt")
    });
  });

  it("allows child paths from a UNC share root", () => {
    const result = resolveSharedPath("//server/share/", "file.txt");

    expect(result).toEqual({
      ok: true,
      path: path.win32.resolve("//server/share/file.txt")
    });
  });

  it("realpath validation rejects a link that resolves outside the shared root", async () => {
    const realpath = createFakeRealpath({
      "C:\\Shared": "C:\\Shared",
      "C:\\Shared\\link": "C:\\Secret\\file.txt"
    });

    const result = await resolveSharedRealPath("C:/Shared", "link", realpath);

    expect(result.ok).toBe(false);
  });

  it("realpath validation allows a child that resolves inside the shared root", async () => {
    const realpath = createFakeRealpath({
      "C:\\Shared": "C:\\Shared",
      "C:\\Shared\\folder\\file.txt": "C:\\Shared\\folder\\file.txt"
    });

    const result = await resolveSharedRealPath("C:/Shared", "folder/file.txt", realpath);

    expect(result).toEqual({
      ok: true,
      path: "C:\\Shared\\folder\\file.txt"
    });
  });
});

function createFakeRealpath(map: Record<string, string>): (targetPath: string) => Promise<string> {
  return async (targetPath: string) => {
    const normalizedPath = path.win32.normalize(targetPath);
    const mappedPath = map[normalizedPath];

    if (mappedPath === undefined) {
      throw new Error(`Unexpected realpath: ${normalizedPath}`);
    }

    return mappedPath;
  };
}
