/**
 * Tests for build manifest and incremental-build hashing.
 * Ensures we use content-based (SHA-256) hashing only—no mtime—so CI caches are stable.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type BuildManifest,
  computeCollectionInputHash,
  computeConfigHash,
  getCachedInputHash,
  loadManifest,
  type ManifestCollectionEntry,
  mergeManifest,
  saveManifest,
} from "./manifest.js";

let tempDir: string;

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
});

async function createTempDir(): Promise<string> {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "contenz-manifest-"));
  return tempDir;
}

describe("computeCollectionInputHash", () => {
  it("uses content hashing only: same content produces same hash", async () => {
    const dir = await createTempDir();
    await fs.writeFile(path.join(dir, "schema.ts"), "export const meta = {};", "utf-8");
    await fs.writeFile(path.join(dir, "hello.mdx"), "content", "utf-8");

    const hash1 = await computeCollectionInputHash(dir, ["hello.mdx"], ["mdx"]);
    const hash2 = await computeCollectionInputHash(dir, ["hello.mdx"], ["mdx"]);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("different content produces different hash", async () => {
    const dir = await createTempDir();
    await fs.writeFile(path.join(dir, "schema.ts"), "export const meta = {};", "utf-8");
    await fs.writeFile(path.join(dir, "hello.mdx"), "content A", "utf-8");

    const hash1 = await computeCollectionInputHash(dir, ["hello.mdx"], ["mdx"]);
    await fs.writeFile(path.join(dir, "hello.mdx"), "content B", "utf-8");
    const hash2 = await computeCollectionInputHash(dir, ["hello.mdx"], ["mdx"]);
    expect(hash1).not.toBe(hash2);
  });

  it("mtime does not affect hash (CI-safe)", async () => {
    const dir = await createTempDir();
    await fs.writeFile(path.join(dir, "schema.ts"), "export const meta = {};", "utf-8");
    const contentPath = path.join(dir, "hello.mdx");
    await fs.writeFile(contentPath, "same content", "utf-8");

    const hashBefore = await computeCollectionInputHash(dir, ["hello.mdx"], ["mdx"]);

    // Change mtime only (e.g. as in a fresh git checkout in CI)
    const past = new Date(Date.now() - 60_000);
    await fs.utimes(contentPath, past, past);

    const hashAfter = await computeCollectionInputHash(dir, ["hello.mdx"], ["mdx"]);
    expect(hashAfter).toBe(hashBefore);
  });
});

describe("computeConfigHash", () => {
  it("computes a stable SHA-256 hash for a config object", () => {
    const hash = computeConfigHash({ strict: true, extensions: ["mdx", "md"] });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    // different order should yield different hash in JSON.stringify unless we sort
    // but right now it's just JSON.stringify, so just check it doesn't throw
    expect(computeConfigHash({ a: 1 })).not.toBe(computeConfigHash({ a: 2 }));
  });
});

describe("manifest load/save/merge", () => {
  it("save and load round-trip", async () => {
    const cwd = await createTempDir();
    const manifest: BuildManifest = {
      version: 1,
      cwd,
      outputDir: path.join(cwd, "generated/content"),
      sources: ["content/*"],
      generatedAt: new Date().toISOString(),
      collections: [
        {
          name: "faq",
          inputHash: "a".repeat(64),
          outputFiles: ["faq.ts"],
          indexMeta: { name: "faq", hasI18n: false },
        },
      ],
    };
    await saveManifest(manifest);
    const loaded = await loadManifest(cwd);
    expect(loaded).not.toBeNull();
    expect(loaded?.version).toBe(1);
    expect(loaded?.collections).toHaveLength(1);
    expect(loaded?.collections[0].inputHash).toBe("a".repeat(64));
  });

  it("getCachedInputHash returns hash when manifest and paths match", () => {
    const manifest: BuildManifest = {
      version: 1,
      cwd: "/proj",
      outputDir: "/proj/generated/content",
      sources: ["content/*"],
      generatedAt: "",
      configHash: "cfghash",
      collections: [{ name: "faq", inputHash: "abc123", outputFiles: ["faq.ts"] }],
    };
    expect(
      getCachedInputHash(
        manifest,
        "/proj",
        "/proj/generated/content",
        ["content/*"],
        "faq",
        "cfghash"
      )
    ).toBe("abc123");

    expect(
      getCachedInputHash(
        manifest,
        "/proj",
        "/proj/generated/content",
        ["content/*"],
        "other",
        "cfghash"
      )
    ).toBeNull();
  });

  it("getCachedInputHash returns null if config hash mismatches", () => {
    const manifest: BuildManifest = {
      version: 1,
      cwd: "/proj",
      outputDir: "/proj/generated/content",
      sources: ["content/*"],
      generatedAt: "",
      configHash: "cfghash",
      collections: [{ name: "faq", inputHash: "abc123", outputFiles: ["faq.ts"] }],
    };
    expect(
      getCachedInputHash(
        manifest,
        "/proj",
        "/proj/generated/content",
        ["content/*"],
        "faq",
        "different"
      )
    ).toBeNull();
  });

  it("mergeManifest updates and preserves collections", () => {
    const existing: BuildManifest = {
      version: 1,
      cwd: "/p",
      outputDir: "/p/out",
      sources: ["content/*"],
      generatedAt: "",
      collections: [{ name: "faq", inputHash: "old", outputFiles: ["faq.ts"] }],
    };
    const updates: ManifestCollectionEntry[] = [
      { name: "faq", inputHash: "new", outputFiles: ["faq.ts"] },
      { name: "docs", inputHash: "docHash", outputFiles: ["docs.ts"] },
    ];
    const merged = mergeManifest(existing, "/p", "/p/out", ["content/*"], updates, "newCfgHash");
    expect(merged.collections).toHaveLength(2);
    expect(merged.configHash).toBe("newCfgHash");
    const faq = merged.collections.find((c) => c.name === "faq");
    const docs = merged.collections.find((c) => c.name === "docs");
    expect(faq?.inputHash).toBe("new");
    expect(docs?.inputHash).toBe("docHash");
  });
});
