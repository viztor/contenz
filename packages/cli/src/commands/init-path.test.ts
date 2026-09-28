/**
 * Unit tests for init --dir containment.
 * Injects path.win32 / path.posix so Linux CI covers Windows semantics.
 */

import nodePath from "node:path";

import { describe, expect, it } from "vitest";

import { resolveUnderCwd, type PathLike } from "./init-path.js";

type Case = {
  name: string;
  cwd: string;
  dir: string;
  ok: boolean;
  /** When ok, expected relative path (platform seps already applied by pathImpl). */
  relative?: string;
};

function runTable(pathImpl: PathLike, cases: Case[]) {
  for (const c of cases) {
    const result = resolveUnderCwd(c.cwd, c.dir, pathImpl);
    if (c.ok) {
      expect(result.ok, c.name).toBe(true);
      if (result.ok) {
        expect(result.relative, c.name).toBe(c.relative);
        expect(result.resolved, c.name).toBe(pathImpl.resolve(c.cwd, c.dir));
        // Containment invariant
        const rel = pathImpl.relative(c.cwd, result.resolved);
        expect(rel.startsWith("..") || pathImpl.isAbsolute(rel), c.name).toBe(
          false
        );
      }
    } else {
      expect(result.ok, c.name).toBe(false);
    }
  }
}

describe("resolveUnderCwd (path.posix)", () => {
  const pathImpl = nodePath.posix;
  const cwd = "/proj";

  it("accepts project-relative dirs", () => {
    runTable(pathImpl, [
      { name: "content", cwd, dir: "content", ok: true, relative: "content" },
      {
        name: "src/content",
        cwd,
        dir: "src/content",
        ok: true,
        relative: "src/content",
      },
      { name: "dot", cwd, dir: ".", ok: true, relative: "" },
      {
        name: "normalize redundant",
        cwd,
        dir: "content/../content",
        ok: true,
        relative: "content",
      },
    ]);
  });

  it("rejects traversal, absolute, empty, nul", () => {
    runTable(pathImpl, [
      { name: "parent", cwd, dir: "..", ok: false },
      { name: "parent slash", cwd, dir: "../", ok: false },
      { name: "nested escape", cwd, dir: "foo/../../outside", ok: false },
      { name: "abs root", cwd, dir: "/etc", ok: false },
      { name: "abs deep", cwd, dir: "/tmp/evil", ok: false },
      { name: "empty", cwd, dir: "", ok: false },
      { name: "nul", cwd, dir: "content\0x", ok: false },
    ]);
  });

  it("documents claimed Sentinel payload stays in-tree on posix", () => {
    // foo/../\windows normalizes to \windows (not absolute on posix).
    // resolve-under-cwd keeps it under /proj as a relative name.
    const dir = "foo/../\\windows";
    const result = resolveUnderCwd(cwd, dir, pathImpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.relative).toBe("\\windows");
      expect(result.resolved.startsWith(cwd + "/")).toBe(true);
      expect(pathImpl.isAbsolute(pathImpl.normalize(dir))).toBe(false);
    }
  });
});

describe("resolveUnderCwd (path.win32)", () => {
  const pathImpl = nodePath.win32;
  const cwd = "C:\\proj";

  it("accepts project-relative dirs", () => {
    runTable(pathImpl, [
      { name: "content", cwd, dir: "content", ok: true, relative: "content" },
      {
        name: "src/content mixed seps",
        cwd,
        dir: "src/content",
        ok: true,
        relative: "src\\content",
      },
      { name: "dot", cwd, dir: ".", ok: true, relative: "" },
      {
        name: "normalize redundant",
        cwd,
        dir: "content\\..\\content",
        ok: true,
        relative: "content",
      },
    ]);
  });

  it("rejects ../, absolute drive, UNC, empty, nul", () => {
    runTable(pathImpl, [
      { name: "parent", cwd, dir: "..", ok: false },
      { name: "parent slash", cwd, dir: "..\\", ok: false },
      { name: "nested escape", cwd, dir: "foo\\..\\..\\outside", ok: false },
      { name: "abs drive", cwd, dir: "C:\\windows", ok: false },
      { name: "abs root slash", cwd, dir: "\\windows", ok: false },
      { name: "unc", cwd, dir: "\\\\server\\share", ok: false },
      { name: "unc forward", cwd, dir: "//server/share", ok: false },
      { name: "empty", cwd, dir: "", ok: false },
      { name: "nul", cwd, dir: "content\0x", ok: false },
    ]);
  });

  it("rejects drive-letter mid-path / other-drive quirks", () => {
    runTable(pathImpl, [
      // normalize → .\C:\windows; relative after resolve is absolute → escape
      {
        name: "drive mid-path",
        cwd,
        dir: "foo\\..\\C:\\windows",
        ok: false,
      },
      // drive-relative without root jumps off cwd
      { name: "other drive relative", cwd, dir: "D:foo", ok: false },
      { name: "other drive abs", cwd, dir: "D:\\foo", ok: false },
    ]);
  });

  it("documents claimed Sentinel payload stays in-tree on win32 (FP claim)", () => {
    // Sentinel claimed foo/../\windows becomes absolute \windows after normalize.
    // On current Node win32: normalize → "windows", isAbsolute → false;
    // resolve-under-cwd accepts it as C:\proj\windows (in-tree).
    const dir = "foo/../\\windows";
    const normalized = pathImpl.normalize(dir);
    expect(pathImpl.isAbsolute(dir)).toBe(false);
    expect(normalized).toBe("windows");
    expect(pathImpl.isAbsolute(normalized)).toBe(false);

    const result = resolveUnderCwd(cwd, dir, pathImpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.relative).toBe("windows");
      expect(result.resolved).toBe("C:\\proj\\windows");
    }
  });
});
