import fs from "node:fs";
import path from "node:path";

export type SafePathResult = { ok: true; path: string } | { ok: false; reason: string };
export type RealpathImpl = (targetPath: string) => Promise<string>;

export function resolveSharedPath(sharedRoot: string, requestedPath: string): SafePathResult {
  const resolvedRoot = path.win32.resolve(sharedRoot);

  if (hasParentTraversal(requestedPath)) {
    return { ok: false, reason: "Parent traversal is not allowed." };
  }

  const resolvedPath = path.win32.resolve(resolvedRoot, requestedPath);

  if (!isInsideOrEqual(resolvedRoot, resolvedPath)) {
    return { ok: false, reason: "Path escapes the shared folder." };
  }

  return { ok: true, path: resolvedPath };
}

export async function resolveSharedRealPath(
  sharedRoot: string,
  requestedPath: string,
  realpathImpl: RealpathImpl = fs.promises.realpath
): Promise<SafePathResult> {
  const lexicalResult = resolveSharedPath(sharedRoot, requestedPath);

  if (!lexicalResult.ok) {
    return lexicalResult;
  }

  const [realRoot, realTarget] = await Promise.all([
    realpathImpl(path.win32.resolve(sharedRoot)),
    realpathImpl(lexicalResult.path)
  ]);

  if (!isInsideOrEqual(realRoot, realTarget)) {
    return { ok: false, reason: "Real path escapes the shared folder." };
  }

  return { ok: true, path: realTarget };
}

function hasParentTraversal(requestedPath: string): boolean {
  return requestedPath.split(/[\\/]+/).includes("..");
}

function isInsideOrEqual(root: string, target: string): boolean {
  const normalizedRoot = trimTrailingSeparators(root).toLowerCase();
  const normalizedTarget = trimTrailingSeparators(target).toLowerCase();
  const rootPrefix = normalizedRoot.endsWith(path.win32.sep)
    ? normalizedRoot
    : `${normalizedRoot}${path.win32.sep}`;

  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(rootPrefix);
}

function trimTrailingSeparators(value: string): string {
  const parsed = path.win32.parse(value);
  let trimmed = path.win32.normalize(value);

  while (trimmed.length > parsed.root.length && /[\\/]$/.test(trimmed)) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed;
}
