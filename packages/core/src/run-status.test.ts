import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBuild } from "./run-build.js";
import { runStatus } from "./run-status.js";
import { prepareFixture } from "./test-fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

async function useFixture(name: string): Promise<string> {
  const dir = await prepareFixture(name);
  tempDirs.push(dir);
  return dir;
}

describe("runStatus", () => {
  it("returns needs-build when no build has been run", async () => {
    const cwd = await useFixture("minimal");

    const result = await runStatus({ cwd });

    expect(result.status).toBe("needs-build");
    expect(result.dirtyCollections.length).toBeGreaterThan(0);
    expect(result.freshCollections).toEqual([]);
    expect(result.message).toMatch(/need rebuild|No collections|Invalid|Failed/);
  });

  it("returns up-to-date after successful build", async () => {
    const cwd = await useFixture("minimal");
    await runBuild({ cwd });

    const result = await runStatus({ cwd });

    expect(result.status).toBe("up-to-date");
    expect(result.message).toContain("up to date");
    expect(result.dirtyCollections).toEqual([]);
    expect(result.freshCollections).toContain("faq");
  });

  it("returns needs-build when content file changed", async () => {
    const cwd = await useFixture("minimal");
    await runBuild({ cwd });
    const contentPath = path.join(cwd, "content", "faq", "hello.mdx");
    const original = await fs.readFile(contentPath, "utf-8");
    await fs.writeFile(contentPath, `${original}\n`, "utf-8");

    const result = await runStatus({ cwd });

    await fs.writeFile(contentPath, original, "utf-8");
    expect(result.status).toBe("needs-build");
    expect(result.dirtyCollections).toContain("faq");
  });

  it("returns needs-build when output is missing", async () => {
    const cwd = await useFixture("minimal");
    await runBuild({ cwd });
    await fs.unlink(path.join(cwd, "generated", "content", "faq.ts"));

    const result = await runStatus({ cwd });

    expect(result.status).toBe("needs-build");
    expect(result.dirtyCollections).toContain("faq");
  });

  it("accepts sources override", async () => {
    const cwd = await useFixture("minimal");
    await runBuild({ cwd });

    const result = await runStatus({ cwd, sources: ["content/*"] });

    expect(result.status).toBe("up-to-date");
  });

  it("returns needs-build for empty or invalid config when no collections", async () => {
    const cwd = await useFixture("empty");

    const result = await runStatus({ cwd });

    expect(result.status).toBe("needs-build");
  });
});
