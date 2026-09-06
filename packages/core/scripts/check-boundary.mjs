/**
 * Source-level layering guard for `@contenz/core`.
 *
 * The pure set (edge-safe modules) must never import Node.js builtins,
 * Node-side sibling modules, or unlisted third-party packages. This runs in
 * milliseconds on source (no build needed) and fails CI via `pnpm lint`.
 * `scripts/check-edge.mjs` covers the same invariant on the built bundle;
 * this script catches it at authoring time with file:line precision.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src"
);

/** Edge-safe modules: the `./reader` (and future `./search`) import graph. */
const PURE_MODULES = new Set([
  "define-collection.ts",
  "format-adapter.ts",
  "i18n.ts",
  "i18n-utils.ts",
  "introspect.ts",
  "merge-config.ts",
  "parse-content.ts",
  "reader.ts",
  "search.ts",
  "storage.ts",
  "types.ts",
  "validator.ts",
  "writer.ts",
]);

/** Third-party packages the pure set may import (nothing else). */
const BARE_ALLOWLIST = new Set([
  "p-map",
  "zod",
  // Orama core + persistence ROOT entry only (both verified node-free).
  // The `/server` subpath (fs persistence) is never allowed here.
  "@orama/orama",
  "@orama/plugin-data-persistence",
]);

/**
 * Subpaths that are never allowed in pure modules even when their package
 * root is allowlisted (fs-backed persistence would poison the edge graph).
 */
const BARE_DENY_SUBPATHS = ["@orama/plugin-data-persistence/server"];

/** Node.js builtins, with or without the `node:` prefix. */
const NODE_BUILTINS = new Set(
  "assert,buffer,child_process,cluster,crypto,dgram,dns,domain,events,fs,http,https,inspector,module,net,os,path,punycode,querystring,readline,repl,stream,string_decoder,timers,tls,trace_events,tty,url,util,v8,vm,worker_threads,zlib,perf_hooks,async_hooks,process,console,constants,sys".split(
    ","
  )
);

const IMPORT_FROM = /(?:import|export)[^'"\n]*from\s*['"]([^'"\n]+)['"]/g;
const DYNAMIC_IMPORT = /import\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const REQUIRE_CALL = /require\(\s*['"]([^'"\n]+)['"]\s*\)/g;

function specKind(spec) {
  if (spec.startsWith(".")) return "relative";
  const withoutPrefix = spec.startsWith("node:") ? spec.slice(5) : spec;
  const base = withoutPrefix.split("/")[0];
  if (NODE_BUILTINS.has(withoutPrefix) || NODE_BUILTINS.has(base)) {
    return "node";
  }
  return "bare";
}

function checkFile(filename) {
  const violations = [];
  const raw = readFileSync(path.join(srcDir, filename), "utf-8");
  // Doc examples (JSDoc blocks, trailing // comments) are not imports.
  // Block comments are stripped wholesale; a // comment is cut only when no
  // quote precedes it on the line (so https:// URLs inside strings survive).
  const withoutBlocks = raw.replace(/\/\*[\s\S]*?\*\//g, (block) =>
    block.includes("\n") ? "\n".repeat(block.split("\n").length - 1) : ""
  );
  const lines = withoutBlocks.split("\n").map((line) => {
    // `import type ...` is erased at compile time — never a runtime edge risk.
    if (/^\s*import\s+type\b/.test(line)) return "";
    const commentAt = line.indexOf("//");
    if (commentAt === -1) return line;
    const firstQuote = line.search(/['"`]/);
    return firstQuote === -1 || commentAt < firstQuote
      ? line.slice(0, commentAt)
      : line;
  });
  const patterns = [IMPORT_FROM, DYNAMIC_IMPORT, REQUIRE_CALL];
  const findings = [];
  for (const [index, line] of lines.entries()) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const spec = match[1];
        const kind = specKind(spec);
        if (kind === "node") {
          findings.push(
            `${filename}:${index + 1}: node import "${spec}" in pure module`
          );
        } else if (kind === "relative") {
          const target = path.basename(spec).replace(/\.js$/, ".ts");
          if (!PURE_MODULES.has(target)) {
            findings.push(
              `${filename}:${index + 1}: pure module imports node-side "${spec}"`
            );
          }
        } else {
          if (
            BARE_DENY_SUBPATHS.some(
              (denied) => spec === denied || spec.startsWith(`${denied}/`)
            )
          ) {
            findings.push(
              `${filename}:${index + 1}: banned subpath import "${spec}" in pure module (fs-backed persistence poisons the edge graph)`
            );
            continue;
          }
          const base = spec.startsWith("@")
            ? spec.split("/").slice(0, 2).join("/")
            : spec.split("/")[0];
          if (!BARE_ALLOWLIST.has(base)) {
            findings.push(
              `${filename}:${index + 1}: bare import "${spec}" not allowlisted for pure modules`
            );
          }
        }
      }
    }
  }
  return findings;
}

const violations = [];
for (const entry of readdirSync(srcDir)) {
  if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
  if (!PURE_MODULES.has(entry)) continue;
  violations.push(...checkFile(entry));
}

if (violations.length > 0) {
  console.error(
    "check-boundary: ineligible imports in edge-safe (pure) modules:"
  );
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error(
    "Pure modules (./reader graph) may only import pure siblings + allowlisted deps. " +
      "Move Node-only code behind ./api (e.g. src/storage-node.ts)."
  );
  process.exit(1);
}

console.log(
  `check-boundary: ${PURE_MODULES.size} pure modules clean (no node/node-side/unlisted imports).`
);
