/**
 * i18n configuration normalization and locale fallback resolution.
 *
 * This module is the single source of truth for:
 * - normalizing the user-facing `I18nConfigShape` (boolean | rich object)
 *   into the resolved shape used at build/lint time
 * - walking locale fallback chains when a locale is missing
 *
 * Both the generator (merged output), the split-output generator, and the
 * build pipeline use `resolveI18nEntry` so fallback semantics cannot drift
 * between surfaces.
 */

import type { I18nConfigShape, ResolvedI18nConfig } from "./types.js";

export type { ResolvedI18nConfig };

// ── Normalization ───────────────────────────────────────────────────────────

/** Sentinel key used when a fallback array (or defaultLocale) defines a global fallback. */
const DEFAULT_FALLBACK_KEY = "__default" as const;

/** Maximum depth of a fallback chain walk; guards against malformed cycles. */
const MAX_FALLBACK_DEPTH = 5;

export function isI18nEnabled(
  raw: boolean | I18nConfigShape | undefined
): boolean {
  if (typeof raw === "boolean") return raw;
  if (raw == null) return false;
  return raw.enabled;
}

/**
 * Normalize the raw i18n config (boolean or rich shape) into a full
 * `ResolvedI18nConfig`. Always returns a complete object — when disabled,
 * every field carries its inert default.
 *
 * Fallback normalization (Phase 2.1 chains):
 * - `fallback: ["en"]` — every locale falls back to `en` (single-step or chain)
 * - `fallback: { "zh-TW": ["zh", "en"] }` — per-locale chains in declaration order
 * - `fallback: { "zh-Hant": "zh" }` — record shorthand for single-step chains
 */
export function normalizeI18nConfig(
  raw: boolean | I18nConfigShape | undefined
): ResolvedI18nConfig {
  if (!isI18nEnabled(raw)) {
    return {
      enabled: false,
      defaultLocale: null,
      locales: [],
      fallbackMap: {},
      fallbackChains: {},
      defaultFallbackChain: [],
      coverageThreshold: null,
      detectStale: false,
      includeFallbackMetadata: false,
      outputStrategy: "merged",
    };
  }

  const shape = (
    typeof raw === "object" && raw !== null ? raw : {}
  ) as I18nConfigShape;

  const defaultLocale =
    typeof shape.defaultLocale === "string" ? shape.defaultLocale : null;

  const locales = Array.isArray(shape.locales)
    ? [
        ...new Set(
          shape.locales.filter((l): l is string => typeof l === "string")
        ),
      ]
    : [];

  const fallbackChains: Record<string, string[]> = {};
  let defaultFallbackChain: string[] = [];

  if (Array.isArray(shape.fallback)) {
    defaultFallbackChain = shape.fallback.filter(
      (l): l is string => typeof l === "string"
    );
  } else if (shape.fallback && typeof shape.fallback === "object") {
    for (const [locale, chain] of Object.entries(shape.fallback)) {
      if (locale === DEFAULT_FALLBACK_KEY) continue;
      let normalized: string[] = [];
      if (Array.isArray(chain)) {
        normalized = chain.filter((l): l is string => typeof l === "string");
      } else if (typeof chain === "string") {
        normalized = [chain];
      }
      if (normalized.length > 0) fallbackChains[locale] = normalized;
    }
    // Record shorthand may define a global default via the sentinel key.
    const sentinel = (shape.fallback as Record<string, unknown>)[
      DEFAULT_FALLBACK_KEY
    ];
    if (Array.isArray(sentinel)) {
      defaultFallbackChain = sentinel.filter(
        (l): l is string => typeof l === "string"
      );
    } else if (typeof sentinel === "string") {
      defaultFallbackChain = [sentinel];
    }
  }

  // Legacy single-step map used by older surfaces; kept for API compat.
  const fallbackMap: Record<string, string> = {};
  for (const [locale, chain] of Object.entries(fallbackChains)) {
    if (chain[0]) fallbackMap[locale] = chain[0];
  }
  if (defaultFallbackChain[0])
    fallbackMap[DEFAULT_FALLBACK_KEY] = defaultFallbackChain[0];

  const coverageThreshold =
    typeof shape.coverageThreshold === "number" &&
    shape.coverageThreshold >= 0 &&
    shape.coverageThreshold <= 1
      ? shape.coverageThreshold
      : null;

  return {
    enabled: true,
    defaultLocale,
    locales,
    fallbackMap,
    fallbackChains,
    defaultFallbackChain,
    coverageThreshold,
    detectStale: shape.detectStale === true,
    includeFallbackMetadata: shape.includeFallbackMetadata === true,
    outputStrategy: shape.outputStrategy === "split" ? "split" : "merged",
  };
}

// ── Fallback resolution ─────────────────────────────────────────────────────

/** A single resolved entry plus metadata about which locale served it. */
export interface ResolvedLocaleEntry<T> {
  /** The file that provided the entry */
  file: string;
  /** The metadata for the resolved locale */
  meta: T;
  /** Set when the entry was served by a fallback locale (the locale used) */
  _fallback?: string;
}

/**
 * Resolve one entry for `locale`, walking the fallback chain.
 *
 * Chain for `locale` is: [locale, ...config chain...]. The first locale with
 * a present entry wins. `_fallback` always reports which locale served the
 * entry (set only on fallback hits); callers decide whether to embed it in
 * output (see `includeFallbackMetadata`).
 */
export function resolveI18nEntry<T>(
  locales: Record<string, { file: string; meta: T }>,
  locale: string,
  config: Pick<ResolvedI18nConfig, "fallbackChains" | "defaultFallbackChain">
): ResolvedLocaleEntry<T> | null {
  const direct = locales[locale];
  if (direct !== undefined) {
    return { file: direct.file, meta: direct.meta };
  }

  const chain = config.fallbackChains[locale] ?? config.defaultFallbackChain;

  const visited = new Set<string>([locale]);
  let depth = 0;
  for (const fallbackLocale of chain) {
    if (visited.has(fallbackLocale) || depth >= MAX_FALLBACK_DEPTH) break;
    visited.add(fallbackLocale);
    depth += 1;
    const entry = locales[fallbackLocale];
    if (entry !== undefined) {
      return { file: entry.file, meta: entry.meta, _fallback: fallbackLocale };
    }
  }
  return null;
}

/**
 * Resolve the ordered fallback chain for a locale (the locale itself first,
 * then its configured fallbacks, then the global default chain). Used by the
 * generated `_locale.ts` resolver and diagnostics.
 */
export function getFallbackChain(
  locale: string,
  config: Pick<ResolvedI18nConfig, "fallbackChains" | "defaultFallbackChain">
): string[] {
  return [
    locale,
    ...(config.fallbackChains[locale] ?? config.defaultFallbackChain),
  ];
}
