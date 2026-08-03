import {
  getLocalizedItem,
  listLocalizedItems,
  type Collection,
  type LocalizeOptions,
  type ResolvedEntry,
} from "./localize.js";

export interface ContentContext<
  C extends Record<string, Collection> = Record<string, Collection>,
> extends LocalizeOptions {
  /** All generated collections keyed by name */
  collections: C;
}

export interface CollectionContent {
  /** Get one entry by slug, falling back to defaultLocale when missing */
  get: (slug: string) => ResolvedEntry | undefined;
  /** All entries for this locale (each resolved with fallback) */
  all: () => ResolvedEntry[];
  /** Slugs present in the collection */
  slugs: () => string[];
  /** Whether an entry exists (in any locale) */
  has: (slug: string) => boolean;
  /** Collection name this handle was created for */
  name: string;
}

export type ContentApi = {
  /** Requested locale for this content context */
  locale: string;
  /** Access a collection by name: `content.collection("faq")?.get("moq")` */
  collection: (name: string) => CollectionContent | undefined;
  /** Collection names available on this content handle */
  collectionNames: () => string[];
};

/** Typed content handle — named collections are also properties when known. */
export type Content<
  C extends Record<string, Collection> = Record<string, Collection>,
> = ContentApi & {
  [K in keyof C]: CollectionContent;
};

function collectionApi(
  name: string,
  data: Collection,
  options: LocalizeOptions
): CollectionContent {
  return {
    name,
    get: (slug) => getLocalizedItem(data, slug, options),
    all: () => listLocalizedItems(data, options),
    slugs: () => Object.keys(data),
    has: (slug) => slug in data,
  };
}

/**
 * Create a locale-bound content resolver for reading Contenz generated output.
 *
 * Named collections are available both via `.collection(name)` and as direct
 * properties (`content.faq.get("moq")`) when TypeScript knows the collection map.
 *
 * @example Next.js App Router
 * ```ts
 * import { faq, blog } from "@/generated/content";
 * import { createContent } from "@contenz/client";
 *
 * const content = createContent({
 *   locale: params.locale,
 *   defaultLocale: "en",
 *   fallback: { zh: "en" },
 *   collections: { faq, blog },
 * });
 *
 * const entry = content.faq.get("moq");
 * // or: content.collection("faq")?.get("moq")
 * entry?.question;           // localized string
 * entry?._resolvedFrom;      // "en" when ja fell back to default
 * ```
 */
export function createContent<C extends Record<string, Collection>>(
  ctx: ContentContext<C>
): Content<C> {
  const { collections, locale, defaultLocale, fallback } = ctx;
  const options: LocalizeOptions = { locale, defaultLocale, fallback };

  const cache = new Map<string, CollectionContent>();

  const getCollection = (name: string): CollectionContent | undefined => {
    const hit = cache.get(name);
    if (hit) return hit;
    const data = collections[name];
    if (!data) return undefined;
    const api = collectionApi(name, data, options);
    cache.set(name, api);
    return api;
  };

  const api: ContentApi = {
    locale,
    collection: getCollection,
    collectionNames: () => Object.keys(collections),
  };

  // Attach known collection keys as own properties for ergonomic access + typing.
  for (const name of Object.keys(collections)) {
    Object.defineProperty(api, name, {
      enumerable: true,
      configurable: true,
      get: () => getCollection(name),
    });
  }

  return api as Content<C>;
}
