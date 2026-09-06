/**
 * Explicit composition for the single central config.
 *
 * There is exactly one config file per project (`contenz.config.ts`); nothing
 * is auto-loaded from collection directories. Shared fragments (monorepo base
 * configs, preset bundles) compose through normal imports plus this helper:
 *
 * ```ts
 * import { mergeContenzConfig } from "@contenz/core";
 * import { base } from "./contenz.base.js";
 *
 * export const config = mergeContenzConfig(base, {
 *   collections: { faq: { path: "content/faq", schema } },
 * });
 * ```
 *
 * Merge rules (documented, no magic):
 * - plain objects → deep-merged key by key (so `collections`/`singles` merge
 *   per name, and nested `config` objects combine);
 * - arrays → concatenated and deduplicated (primitives by value, objects and
 *   functions by reference);
 * - everything else (scalars, Zod schemas, RegExps, functions, class
 *   instances, adapters, hooks) → last wins by reference;
 * - `undefined` values are skipped (never overwrite).
 *
 * Pure module — zero `node:` imports.
 */

import type { ContenzConfig } from "./types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function mergeValues(current: unknown, next: unknown): unknown {
  if (next === undefined) return current;
  if (Array.isArray(current) && Array.isArray(next)) {
    const seen = new Set<unknown>();
    const out: unknown[] = [];
    for (const item of [...current, ...next]) {
      // Objects/functions dedupe by reference; primitives by value.
      const key =
        item !== null && typeof item === "object"
          ? item
          : `primitive:${typeof item}:${String(item)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }
  if (isPlainObject(current) && isPlainObject(next)) {
    const out: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      out[key] = key in out ? mergeValues(out[key], value) : value;
    }
    return out;
  }
  return next;
}

/**
 * Merge partial configs left to right (later wins per the rules above).
 * Falsy partials are skipped so conditional spreads stay ergonomic.
 */
export function mergeContenzConfig(
  ...partials: Array<
    Partial<ContenzConfig> | ContenzConfig | undefined | null | false
  >
): ContenzConfig {
  let merged: unknown = {};
  for (const partial of partials) {
    if (!partial) continue;
    merged = mergeValues(merged, partial);
  }
  return merged as ContenzConfig;
}
