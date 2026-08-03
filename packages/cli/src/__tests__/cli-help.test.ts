/**
 * Lightweight CLI tests via Stricli injectable context (no process spawn).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { run } from "@stricli/core";
import { afterEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import type { ContenzContext } from "../context.js";

function createTestContext() {
  let stdout = "";
  let stderr = "";
  let exitCode: number | string | null | undefined;

  const mockProcess = {
    stdout: {
      write(str: string) {
        stdout += str;
        return true;
      },
    },
    stderr: {
      write(str: string) {
        stderr += str;
        return true;
      },
    },
    env: { ...process.env },
    get exitCode() {
      return exitCode;
    },
    set exitCode(code: number | string | null | undefined) {
      exitCode = code;
    },
    on() {
      return mockProcess;
    },
    off() {
      return mockProcess;
    },
  };

  const context: ContenzContext = {
    process: mockProcess as unknown as NodeJS.Process,
    os: { homedir: () => os.homedir() },
    fs: {
      promises: {
        readFile: fs.promises.readFile.bind(fs.promises),
        writeFile: fs.promises.writeFile.bind(fs.promises),
      },
    },
    path: { join: path.join },
  };

  return {
    context,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
    get exitCode() {
      return exitCode;
    },
  };
}

describe("contenz CLI (Stricli)", () => {
  afterEach(() => {
    // no shared state
  });

  it("prints root help with all primary commands", async () => {
    const t = createTestContext();
    await run(app, ["--help"], t.context);

    expect(t.stdout).toContain("contenz lint");
    expect(t.stdout).toContain("contenz build");
    expect(t.stdout).toContain("contenz create");
    expect(t.stdout).toContain("contenz skill");
    // Hidden completion routes stay out of default help body
    expect(t.stdout).not.toMatch(/COMMANDS[\s\S]*\binstall\b/);
  });

  it("prints version", async () => {
    const t = createTestContext();
    await run(app, ["--version"], t.context);
    expect(t.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("prints build help with enum format values", async () => {
    const t = createTestContext();
    await run(app, ["build", "--help"], t.context);
    expect(t.stdout).toContain("--format");
    expect(t.stdout).toContain("pretty");
    expect(t.stdout).toContain("json");
    expect(t.stdout).toContain("github");
    expect(t.stdout).toContain("--dry-run");
  });

  it("rejects invalid --format enum values", async () => {
    const t = createTestContext();
    await run(app, ["lint", "--format", "xml"], t.context);
    expect(t.stderr).toMatch(/pretty\|json\|github/);
    expect(t.stderr).toContain("xml");
    expect(t.exitCode).not.toBe(0);
    expect(t.exitCode).not.toBeUndefined();
  });

  it("lists create positionals in help", async () => {
    const t = createTestContext();
    await run(app, ["create", "--help"], t.context);
    expect(t.stdout).toContain("collection");
    expect(t.stdout).toContain("slug");
    expect(t.stdout).toContain("--set");
  });
});
