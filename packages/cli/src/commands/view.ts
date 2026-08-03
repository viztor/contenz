import { runView } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { printResult } from "../output.js";
import {
  cwdFlag,
  localeFlag,
  outputFormatFlag,
  type OutputFormat,
} from "../shared.js";

interface ViewFlags {
  cwd: string;
  locale?: string;
  format: OutputFormat;
}

async function view(
  this: ContenzContext,
  flags: ViewFlags,
  collection: string,
  slug: string
): Promise<void> {
  const result = await runView({
    cwd: flags.cwd,
    collection,
    slug,
    locale: flags.locale,
  });
  printResult(this, result, flags.format);
}

export const viewCommandDef = buildCommand({
  func: view,
  parameters: {
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Collection name",
          parse: String,
          placeholder: "collection",
        },
        {
          brief: "Content slug",
          parse: String,
          placeholder: "slug",
        },
      ],
    },
    flags: {
      cwd: cwdFlag,
      locale: localeFlag,
      format: outputFormatFlag,
    },
  },
  docs: {
    brief: "View a content item by collection and slug",
  },
});
