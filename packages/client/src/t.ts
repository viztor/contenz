import {
  getLocalizedItem,
  type Collection,
  type LocalizeOptions,
  type ResolvedEntry,
} from "./localize.js";

export type { Collection, LocalizeOptions, ResolvedEntry };

export interface TFunction {
  /**
   * Read a localized field from a collection item.
   * `t(faq, "moq", "question")` → `"What is MOQ?"` (for the bound locale)
   */
  (collection: Collection, slug: string, field: string): string | undefined;
  /** Full localized entry (meta fields + slug/file) for the bound locale */
  item: (collection: Collection, slug: string) => ResolvedEntry | undefined;
  /** Locale this translator was created with */
  locale: string;
}

function fieldToString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value == null) return undefined;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return undefined;
}

/**
 * Create a locale-bound `t` function for reading Contenz generated content.
 * Prefer `createContent` for typed collection access with fallback metadata.
 */
export function createT(options: LocalizeOptions): TFunction {
  const t = ((collection: Collection, slug: string, field: string) => {
    const entry = getLocalizedItem(collection, slug, options);
    return fieldToString(entry?.[field]);
  }) as TFunction;

  t.item = (collection, slug) => getLocalizedItem(collection, slug, options);
  t.locale = options.locale;

  return t;
}

export { getLocalizedItem, listLocalizedItems } from "./localize.js";
