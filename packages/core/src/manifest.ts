/**
 * Build manifest for incremental builds.
 * Stores per-collection input hashes so unchanged collections can be skipped.
 *
 * Hash strategy: cryptographic content hashing (SHA-256) only. We do not use
 * file modification times (mtime) for cache decisions. mtime is unreliable in
 * CI (e.g. GitHub Actions), where a fresh checkout gives current timestamps
 * and would invalidate the cache every run. Content hashes are stable across
 * checkouts and restores, so incremental builds behave correctly in CI.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface ManifestCollectionEntry {
  name: string;
  inputHash: string;
  outputFiles: string[];
  /** For regenerating index when some collections are skipped */
  indexMeta?: { name: string; types?: string[]; hasI18n: boolean; metaTypeName?: string };
}

export interface BuildManifest {
  version: 1;
  cwd: string;
  outputDir: string;
  sources: string[];
  /** Hash of the resolved project config; invalidates all collections when changed */
  configHash?: string;
  generatedAt: string;
  collections: ManifestCollectionEntry[];
}

const MANIFEST_DIR = ".contenz";
const MANIFEST_FILENAME = "build-manifest.json";

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf-8").digest("hex");
}

/**
 * Compute a stable hash of the resolved project config.
 * Used to invalidate the entire manifest when project-level settings change.
 */
export function computeConfigHash(config: Record<string, unknown>): string {
  // Serialize deterministically: sorted keys, no RegExp/function values
  return sha256(JSON.stringify(config, (_, v) => (v instanceof RegExp ? v.source : v)));
}

async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Compute a stable hash for a collection's inputs: schema, config, and all content files.
 * Uses SHA-256 over file contents only (no mtime). Safe for CI and cache restores.
 */
export async function computeCollectionInputHash(
  collectionPath: string,
  contentFilePaths: string[],
  extensions: string[]
): Promise<string> {
  const parts: string[] = [];

  const schemaPath = path.join(collectionPath, "schema.ts");
  parts.push(await readFileSafe(schemaPath));

  const configPath = path.join(collectionPath, "config.ts");
  parts.push(await readFileSafe(configPath));

  const sortedFiles = [...contentFilePaths].sort();
  for (const file of sortedFiles) {
    const ext = path.extname(file).slice(1);
    if (!extensions.includes(ext)) continue;
    const fullPath = path.join(collectionPath, file);
    const content = await readFileSafe(fullPath);
    parts.push(`${file}\n${content}`);
  }

  return sha256(parts.join("\n"));
}

/**
 * Load the build manifest from cwd/.contenz/build-manifest.json if it exists.
 */
export async function loadManifest(cwd: string): Promise<BuildManifest | null> {
  const manifestPath = path.join(cwd, MANIFEST_DIR, MANIFEST_FILENAME);
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    const data = JSON.parse(raw) as BuildManifest;
    if (data.version !== 1 || !Array.isArray(data.collections)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Save the build manifest to cwd/.contenz/build-manifest.json.
 */
export async function saveManifest(manifest: BuildManifest): Promise<void> {
  const dir = path.join(manifest.cwd, MANIFEST_DIR);
  await fs.mkdir(dir, { recursive: true });
  const manifestPath = path.join(dir, MANIFEST_FILENAME);
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        ...manifest,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf-8"
  );
}

/**
 * Get cached input hash for a collection from the manifest, if it matches current cwd/outputDir/sources.
 */
export function getCachedInputHash(
  manifest: BuildManifest | null,
  cwd: string,
  outputDir: string,
  sources: string[],
  collectionName: string,
  configHash?: string
): string | null {
  if (!manifest || manifest.cwd !== cwd || manifest.outputDir !== outputDir) return null;
  if (
    manifest.sources.length !== sources.length ||
    manifest.sources.some((s, i) => s !== sources[i])
  ) {
    return null;
  }
  // Invalidate all collections if project config changed
  if (configHash && manifest.configHash && manifest.configHash !== configHash) {
    return null;
  }
  const entry = manifest.collections.find((c) => c.name === collectionName);
  return entry?.inputHash ?? null;
}

/**
 * Build a new manifest from current run (after a successful full or partial build).
 * Merges with existing manifest: updates entries for built collections, keeps others.
 */
export function mergeManifest(
  existing: BuildManifest | null,
  cwd: string,
  outputDir: string,
  sources: string[],
  updates: ManifestCollectionEntry[],
  configHash?: string
): BuildManifest {
  const byName = new Map<string, ManifestCollectionEntry>();
  if (existing && existing.cwd === cwd && existing.outputDir === outputDir) {
    for (const e of existing.collections) {
      byName.set(e.name, e);
    }
  }
  for (const e of updates) {
    byName.set(e.name, e);
  }
  return {
    version: 1,
    cwd,
    outputDir,
    sources,
    configHash,
    generatedAt: new Date().toISOString(),
    collections: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
