/**
 * Locale resolution for Contenz generated collections.
 *
 * Resolution order:
 * 1. Requested locale (direct hit)
 * 2. Configured fallback chain (`i18n.fallback` from contenz.config.ts)
 * 3. `defaultLocale` when the requested translation is missing
 * 4. First available locale (last resort)
 */

export interface LocalizeOptions {
  /** Active locale (e.g. from `[locale]` route param) */
  locale: string;
  /** Source locale — used when the requested locale has no translation */
  defaultLocale?: string;
  /**
   * Fallback chain — mirrors `i18n.fallback` in contenz.config.ts.
   * Record: `{ "zh-Hant": "zh", "zh": "en" }` or array `["en"]` for a global fallback.
   */
  fallback?: Record<string, string> | string[];
}

/** Generated collection: slug → item */
export type Collection = Record<string, unknown>;

/** Entry with optional metadata about locale resolution */
export interface ResolvedEntry extends Record<string, unknown> {
  /**
   * Locale that supplied this entry when it differs from the requested locale.
   * e.g. requested `ja`, served `en` → `_resolvedFrom: "en"`
   */
  _resolvedFrom?: string;
}

interface I18nItem {
  slug: string;
  locales: Record<string, Record<string, unknown>>;
}

function isI18nItem(item: unknown): item is I18nItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "locales" in item &&
    typeof (item as I18nItem).locales === "object"
  );
}

function normalizeFallbackMap(
  fallback?: Record<string, string> | string[]
): Record<string, string> {
  if (!fallback) return {};
  if (Array.isArray(fallback)) {
    const target = fallback[0];
    return typeof target === "string" ? { __default: target } : {};
  }
  return fallback;
}

function resolveLocaleEntry(
  item: I18nItem,
  locale: string,
  options: LocalizeOptions
): { entry: Record<string, unknown>; resolvedFrom: string } | undefined {
  const fallbackMap = normalizeFallbackMap(options.fallback);
  const defaultLocale = options.defaultLocale;

  const direct = item.locales[locale];
  if (direct) return { entry: direct, resolvedFrom: locale };

  // Configured fallback chain (e.g. zh-Hant → zh, or __default → en)
  const visited = new Set<string>([locale]);
  let current: string | undefined =
    fallbackMap[locale] ?? fallbackMap.__default;

  while (current && !visited.has(current) && visited.size < 5) {
    visited.add(current);
    const entry = item.locales[current];
    if (entry) return { entry, resolvedFrom: current };
    current = fallbackMap[current] ?? fallbackMap.__default;
  }

  // Default locale — primary fallback when translation is missing
  if (
    defaultLocale &&
    !visited.has(defaultLocale) &&
    item.locales[defaultLocale]
  ) {
    return { entry: item.locales[defaultLocale], resolvedFrom: defaultLocale };
  }

  // Last resort: any available locale
  const [firstLocale, firstEntry] = Object.entries(item.locales)[0] ?? [];
  if (firstLocale && firstEntry) {
    return { entry: firstEntry, resolvedFrom: firstLocale };
  }

  return undefined;
}

function withResolvedMeta(
  entry: Record<string, unknown>,
  requestedLocale: string,
  resolvedFrom: string
): ResolvedEntry {
  if (resolvedFrom === requestedLocale) return entry;
  return { ...entry, _resolvedFrom: resolvedFrom };
}

/**
 * Resolve the localized entry for a slug (i18n or flat collection).
 */
export function getLocalizedItem(
  collection: Collection,
  slug: string,
  options: LocalizeOptions
): ResolvedEntry | undefined {
  const item = collection[slug];
  if (!item || typeof item !== "object") return undefined;

  if (isI18nItem(item)) {
    const resolved = resolveLocaleEntry(item, options.locale, options);
    if (!resolved) return undefined;
    return withResolvedMeta(
      resolved.entry,
      options.locale,
      resolved.resolvedFrom
    );
  }

  return item as ResolvedEntry;
}

/**
 * All slugs in a collection, resolved for the given locale (with fallback).
 */
export function listLocalizedItems(
  collection: Collection,
  options: LocalizeOptions
): ResolvedEntry[] {
  return Object.keys(collection)
    .map((slug) => getLocalizedItem(collection, slug, options))
    .filter((entry): entry is ResolvedEntry => entry !== undefined);
}
