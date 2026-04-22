/**
 * Runtime i18n utilities for contenz.
 *
 * Provides framework-agnostic helpers for:
 * - Extracting locale from URL paths or query parameters
 * - Negotiating locale from Accept-Language headers
 *
 * Import from "@contenz/core" or "@contenz/core/api".
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ParseLocaleFromURLOptions {
  /** Known locale codes */
  locales: string[];
  /** Default locale (returned when no prefix matches) */
  defaultLocale: string;
  /**
   * Strategy for locale detection:
   * - "prefix": check the first path segment (e.g. /en/about → "en")
   * - "query": check a query parameter (e.g. /about?lang=en → "en")
   * @default "prefix"
   */
  strategy?: "prefix" | "query";
  /**
   * Query param name when strategy is "query".
   * @default "lang"
   */
  queryParam?: string;
}

export interface ParsedLocaleURL {
  /** Resolved locale */
  locale: string;
  /** Remaining pathname after locale prefix is stripped */
  pathname: string;
  /** Whether the locale was explicitly present in the URL (vs defaulted) */
  explicit: boolean;
}

// ── parseLocaleFromURL ──────────────────────────────────────────────────────

/**
 * Extract locale from a URL path or query parameter.
 *
 * @example Prefix strategy (default)
 * ```ts
 * parseLocaleFromURL("/en/faq/moq", { locales: ["en", "zh"], defaultLocale: "en" })
 * // → { locale: "en", pathname: "/faq/moq", explicit: true }
 *
 * parseLocaleFromURL("/faq/moq", { locales: ["en", "zh"], defaultLocale: "en" })
 * // → { locale: "en", pathname: "/faq/moq", explicit: false }
 * ```
 *
 * @example Query strategy
 * ```ts
 * parseLocaleFromURL("/faq?lang=zh", { locales: ["en", "zh"], defaultLocale: "en", strategy: "query" })
 * // → { locale: "zh", pathname: "/faq", explicit: true }
 * ```
 */
export function parseLocaleFromURL(
  url: string | URL,
  options: ParseLocaleFromURLOptions
): ParsedLocaleURL {
  const { locales, defaultLocale, strategy = "prefix", queryParam = "lang" } = options;

  // Normalize locales to lowercase for comparison
  const localeSet = new Set(locales.map((l) => l.toLowerCase()));
  const localeMap = new Map(locales.map((l) => [l.toLowerCase(), l]));

  let parsedUrl: URL;
  try {
    parsedUrl = typeof url === "string" ? new URL(url, "http://localhost") : url;
  } catch {
    return {
      locale: defaultLocale,
      pathname: typeof url === "string" ? url : url.pathname,
      explicit: false,
    };
  }

  if (strategy === "query") {
    const paramValue = parsedUrl.searchParams.get(queryParam);
    if (paramValue && localeSet.has(paramValue.toLowerCase())) {
      return {
        locale: localeMap.get(paramValue.toLowerCase()) ?? defaultLocale,
        pathname: parsedUrl.pathname,
        explicit: true,
      };
    }
    return { locale: defaultLocale, pathname: parsedUrl.pathname, explicit: false };
  }

  // Prefix strategy
  const segments = parsedUrl.pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return { locale: defaultLocale, pathname: "/", explicit: false };
  }

  const firstSegment = segments[0].toLowerCase();
  if (localeSet.has(firstSegment)) {
    const remaining = `/${segments.slice(1).join("/")}`;
    return {
      locale: localeMap.get(firstSegment) ?? defaultLocale,
      pathname: remaining,
      explicit: true,
    };
  }

  return { locale: defaultLocale, pathname: parsedUrl.pathname, explicit: false };
}

// ── negotiateLocale ─────────────────────────────────────────────────────────

interface LanguagePreference {
  locale: string;
  quality: number;
}

/**
 * Parse the Accept-Language header and match against available locales.
 *
 * Supports:
 * - Exact matches: "en" in available ["en", "zh"]
 * - Prefix matches: "zh-TW" matches available "zh" (when exact match unavailable)
 * - Quality weights: "zh-TW,zh;q=0.9,en;q=0.8" → prefers zh-TW, then zh, then en
 *
 * @example
 * ```ts
 * negotiateLocale("zh-TW,zh;q=0.9,en;q=0.8", ["en", "zh", "ja"], "en")
 * // → "zh"
 *
 * negotiateLocale("fr,de;q=0.9", ["en", "zh"], "en")
 * // → "en" (no match, returns default)
 * ```
 */
export function negotiateLocale(
  acceptLanguage: string,
  available: string[],
  defaultLocale: string
): string {
  if (!acceptLanguage) return defaultLocale;

  // Parse Accept-Language header
  const preferences: LanguagePreference[] = acceptLanguage
    .split(",")
    .map((part) => {
      const [locale, ...params] = part.trim().split(";");
      let quality = 1;
      for (const param of params) {
        const match = param.trim().match(/^q=(\d+(\.\d+)?)$/);
        if (match) {
          quality = Number.parseFloat(match[1]);
        }
      }
      return { locale: locale.trim().toLowerCase(), quality };
    })
    .filter((p) => p.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  // Build lowercase lookup
  const availableMap = new Map(available.map((l) => [l.toLowerCase(), l]));

  for (const pref of preferences) {
    // Exact match
    if (availableMap.has(pref.locale)) {
      return availableMap.get(pref.locale) ?? defaultLocale;
    }

    // Prefix match: "zh-TW" → try "zh"
    const prefix = pref.locale.split("-")[0];
    if (prefix !== pref.locale && availableMap.has(prefix)) {
      return availableMap.get(prefix) ?? defaultLocale;
    }

    // Reverse prefix: available "zh-Hant" matches request for "zh"
    for (const [lower, original] of availableMap) {
      if (lower.startsWith(`${pref.locale}-`)) {
        return original;
      }
    }
  }

  return defaultLocale;
}
