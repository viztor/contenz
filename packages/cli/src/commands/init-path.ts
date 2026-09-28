/**
 * Resolve --dir under the project cwd and reject path escapes.
 * Injectable PathLike lets unit tests exercise path.win32 / path.posix on any host.
 */

import nodePath from "node:path";

/** Minimal path API so tests can inject path.win32 / path.posix. */
export type PathLike = Pick<
  typeof nodePath,
  "resolve" | "relative" | "isAbsolute" | "normalize" | "sep"
>;

export type ContainedPath =
  | { ok: true; resolved: string; relative: string }
  | { ok: false; reason: "empty" | "absolute" | "escape" | "nul" };

/**
 * Contain contentDir under cwd via resolve + relative.
 * Rejects empty, NUL, absolute inputs, and any resolve that escapes cwd
 * (relative starts with ".." or is absolute — covers drive-letter / UNC quirks).
 */
export function resolveUnderCwd(
  cwd: string,
  contentDir: string,
  pathImpl: PathLike = nodePath
): ContainedPath {
  if (contentDir.length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (contentDir.includes("\0")) {
    return { ok: false, reason: "nul" };
  }
  if (pathImpl.isAbsolute(contentDir)) {
    return { ok: false, reason: "absolute" };
  }

  const resolved = pathImpl.resolve(cwd, contentDir);
  const relative = pathImpl.relative(cwd, resolved);
  if (relative.startsWith("..") || pathImpl.isAbsolute(relative)) {
    return { ok: false, reason: "escape" };
  }

  return { ok: true, resolved, relative };
}
