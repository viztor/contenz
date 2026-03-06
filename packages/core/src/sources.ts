import fs from "node:fs/promises";
import path from "node:path";
import { globby } from "globby";
import type { ContenzConfig } from "./types.js";

const DEFAULT_SOURCES = ["content/*"] as const;
const UNSUPPORTED_GLOB_CHARS = /[?[\]{}!]/;

export interface DiscoveredCollection {
  name: string;
  collectionPath: string;
  source: string;
}

function isAbsoluteLikePath(value: string): boolean {
  return path.posix.isAbsolute(value) || /^[a-zA-Z]:\//.test(value);
}

function isProjectRelativePath(value: string): boolean {
  return value !== "." && value !== ".." && !value.startsWith("../") && !isAbsoluteLikePath(value);
}

export function normalizeLegacyContentDir(contentDir: string): string {
  return `${normalizeSourcePattern(contentDir)}/*`;
}

export function normalizeSourcePattern(source: string): string {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new Error("Source entries must not be empty.");
  }

  if (UNSUPPORTED_GLOB_CHARS.test(trimmed) || trimmed.includes("**")) {
    throw new Error(
      `Unsupported source pattern "${source}". Use a plain path like "docs" or a direct-child pattern like "content/*".`
    );
  }

  const wildcard = trimmed.endsWith("/*") || trimmed.endsWith("\\*");
  if (trimmed.includes("*") && !wildcard) {
    throw new Error(
      `Unsupported source pattern "${source}". Only plain paths and direct-child patterns ending in "/*" are supported.`
    );
  }

  const base = wildcard ? trimmed.slice(0, -2) : trimmed;
  const normalizedBase = path.posix.normalize(base.replaceAll("\\", "/"));
  if (!isProjectRelativePath(normalizedBase)) {
    throw new Error(
      `Invalid source path "${source}". Source paths must be project-relative and cannot point outside the project root.`
    );
  }

  return wildcard ? `${normalizedBase}/*` : normalizedBase;
}

export function resolveSourcePatterns(project: ContenzConfig): string[] {
  if (project.sources && project.sources.length > 0) {
    return project.sources.map(normalizeSourcePattern);
  }

  if (project.contentDir) {
    return [normalizeLegacyContentDir(project.contentDir)];
  }

  return [...DEFAULT_SOURCES];
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function addCollection(
  discovered: Map<string, DiscoveredCollection>,
  errors: string[],
  collection: DiscoveredCollection
): void {
  const existing = discovered.get(collection.name);
  if (!existing) {
    discovered.set(collection.name, collection);
    return;
  }

  if (existing.collectionPath === collection.collectionPath) {
    return;
  }

  errors.push(
    `Collection "${collection.name}" was discovered from both "${existing.source}" and "${collection.source}". Collection names must be unique across sources.`
  );
}

export async function discoverCollections(
  cwd: string,
  sources: string[]
): Promise<{ collections: DiscoveredCollection[]; errors: string[] }> {
  const discovered = new Map<string, DiscoveredCollection>();
  const errors: string[] = [];

  for (const source of sources) {
    const normalizedSource = normalizeSourcePattern(source);

    if (normalizedSource.endsWith("/*")) {
      const sourceRoot = normalizedSource.slice(0, -2);
      const rootDir = path.resolve(cwd, sourceRoot);
      const schemaFiles = await globby("*/schema.ts", {
        cwd: rootDir,
        onlyFiles: true,
      });

      for (const schemaFile of schemaFiles) {
        const collectionName = path.dirname(schemaFile);
        addCollection(discovered, errors, {
          name: collectionName,
          collectionPath: path.join(rootDir, collectionName),
          source: normalizedSource,
        });
      }

      continue;
    }

    const collectionPath = path.resolve(cwd, normalizedSource);
    const schemaPath = path.join(collectionPath, "schema.ts");
    if (!(await pathExists(schemaPath))) {
      continue;
    }

    addCollection(discovered, errors, {
      name: path.basename(normalizedSource),
      collectionPath,
      source: normalizedSource,
    });
  }

  return {
    collections: [...discovered.values()].sort((a, b) => a.name.localeCompare(b.name)),
    errors,
  };
}
