import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const e2eFixturesDir = path.join(repoRoot, "packages", "e2e", "fixtures");
// Point to define-collection.ts instead of index.ts so that fixture schema
// files don't transitively pull in globby/unicorn-magic (ESM-only packages
// that fail under Node 25 + tsx's CJS resolver).  Schema files only need
// defineCollection / defineMultiTypeCollection which live in this module.
const coreSourceImport = pathToFileURL(
  path.join(repoRoot, "packages", "core", "src", "define-collection.ts")
).href;

const adapterMdxSourceImport = pathToFileURL(
  path.join(repoRoot, "packages", "adapter-mdx", "src", "index.ts")
).href;

async function rewriteFixtureImports(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await rewriteFixtureImports(entryPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }

    const source = await fs.readFile(entryPath, "utf-8");
    let rewritten = source;
    if (rewritten.includes("@contenz/core")) {
      rewritten = rewritten.replaceAll('"@contenz/core"', `"${coreSourceImport}"`);
    }
    if (rewritten.includes("@contenz/adapter-mdx")) {
      rewritten = rewritten.replaceAll('"@contenz/adapter-mdx"', `"${adapterMdxSourceImport}"`);
    }

    if (rewritten !== source) {
      await fs.writeFile(entryPath, rewritten, "utf-8");
    }
  }
}

export async function prepareFixture(name: string): Promise<string> {
  const fixtureSource = path.join(e2eFixturesDir, name);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `contenz-core-${name}-`));
  await fs.cp(fixtureSource, tempDir, { recursive: true });
  await rewriteFixtureImports(tempDir);
  return tempDir;
}
