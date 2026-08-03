import { readContent } from "../content-io.js";
import type { ContentOpResult } from "./shared.js";

export interface ViewOptions {
  cwd: string;
  collection: string;
  slug: string;
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
    const result = await readContent(
      opts.cwd,
      opts.collection,
      opts.slug,
      opts.locale
    );

    if (!result) {
      return {
        success: false,
        error: `Content not found: ${opts.collection}/${opts.slug}`,
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
