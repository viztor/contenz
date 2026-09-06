import { readContent } from "../content-io.js";
import { createWorkspace } from "../workspace.js";
import type { ContentOpResult } from "./shared.js";

export interface ViewOptions {
  cwd: string;
  collection: string;
  /** Omit only for singles (defaults to the single name) */
  slug?: string;
  locale?: string;
}

export interface ViewResult {
  slug: string;
  locale: string | null;
  file: string;
  meta: Record<string, unknown>;
  body?: string;
}

export async function runView(
  opts: ViewOptions
): Promise<ContentOpResult<ViewResult>> {
  try {
    let slug = opts.slug;
    if (!slug) {
      // Slugless view addresses a single by name.
      const ws = await createWorkspace({
        cwd: opts.cwd,
        collection: opts.collection,
      });
      const single = ws.getSingle(opts.collection);
      if (!single) {
        return {
          success: false,
          error: `Slug is required (omit only for singles): ${opts.collection}`,
        };
      }
      slug = single.name;
    }
    const result = await readContent(
      opts.cwd,
      opts.collection,
      slug,
      opts.locale
    );

    if (!result) {
      return {
        success: false,
        error: `Content not found: ${opts.collection}/${slug}`,
      };
    }

    return {
      success: true,
      data: {
        slug: result.slug,
        locale: result.locale ?? null,
        file: result.filePath,
        meta: result.meta,
        body: result.body,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
