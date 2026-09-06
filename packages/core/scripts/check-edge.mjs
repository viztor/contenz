/**
 * Edge-compatibility guard for `@contenz/core/reader`.
 *
 * Fails the build if `dist/reader.js` or any chunk it transitively imports
 * statically references a `node:` builtin. tsup code-splits shared modules
 * into `chunk-*.js` files also used by `./api`, so scanning only the entry
 * would miss Node-only code pulled in through shared chunks.
 *
 * The reader entry must stay runnable on Cloudflare Workers, Vercel Edge, and
 * browsers: pure code + Storage backends only (see `src/reader.ts`).
 *
 * Run after `tsup` via the package `build` script.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const distDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist"
);
// Optional argv: entry bundle to check (default reader.js). Used to prove the
// guard bites: `node scripts/check-edge.mjs api.js` must FAIL.
const entryName = process.argv[2] ?? "reader.js";
const entryBundle = path.join(distDir, entryName);

if (!existsSync(entryBundle)) {
  console.error(
    `check-edge: missing bundle at ${entryBundle} (run tsup first)`
  );
  process.exit(1);
}

// NOTE: esbuild strips the `node:` prefix (dist contains `from "fs/promises"`,
// not `from "node:fs/promises"`), so bare builtin names must match too.
const NODE_BUILTINS = [
  "assert",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "worker_threads",
  "zlib",
  "perf_hooks",
  "async_hooks",
  "process",
  "console",
  "constants",
  "sys",
];
const BUILTIN_ALT = NODE_BUILTINS.map((m) =>
  m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
).join("|");
const NODE_PATTERNS = [
  new RegExp(
    `(?:import|export)[^'"\\n]*from\\s*['"](?:node:)?(?:${BUILTIN_ALT})(?:/[^'"\\n]*)?['"]`,
    "g"
  ),
  new RegExp(
    `import\\(\\s*['"](?:node:)?(?:${BUILTIN_ALT})(?:/[^'"\\n]*)?['"]\\s*\\)`,
    "g"
  ),
  new RegExp(
    `require\\(\\s*['"](?:node:)?(?:${BUILTIN_ALT})(?:/[^'"\\n]*)?['"]\\s*\\)`,
    "g"
  ),
];
const RELATIVE_IMPORT = /(?:import|export)[^'"\n]*from\s*['"](\.[^'"\n]+)['"]/g;
const DYNAMIC_IMPORT = /import\(\s*['"](\.[^'"\n]+)['"]\s*\)/g;

/** Walk the local chunk graph reachable from the entry (tsup code-splitting). */
function reachableFiles(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    let source;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    for (const pattern of [RELATIVE_IMPORT, DYNAMIC_IMPORT]) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const resolved = path.resolve(path.dirname(file), match[1]);
        const candidates = [resolved, `${resolved}.js`];
        for (const candidate of candidates) {
          if (
            candidate.startsWith(distDir) &&
            !seen.has(candidate) &&
            existsSync(candidate)
          ) {
            queue.push(candidate);
          }
        }
      }
    }
  }
  return seen;
}

const violations = [];
for (const file of reachableFiles(entryBundle)) {
  const source = readFileSync(file, "utf-8");
  for (const pattern of NODE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      violations.push(`${path.basename(file)}: ${match[0]}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    `check-edge: the ${entryName} graph imports Node.js builtins (edge-unsafe):`
  );
  for (const violation of new Set(violations)) {
    console.error(`  - ${violation}`);
  }
  console.error(
    "Move Node-only code behind src/storage-node.ts (./api) and keep ./reader pure."
  );
  process.exit(1);
}

console.log(`check-edge: ${entryName} graph is edge-clean (no node imports).`);
