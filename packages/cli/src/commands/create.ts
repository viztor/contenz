import { runCreate } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { printResult } from "../output.js";
import {
  contentTypeFlag,
  cwdFlag,
  localeFlag,
  outputFormatFlag,
  parseSetPairs,
  setFlag,
  type OutputFormat,
} from "../shared.js";

interface CreateFlags {
  cwd: string;
  locale?: string;
  set?: readonly string[];
  type?: string;
  format: OutputFormat;
}

async function create(
  this: ContenzContext,
  flags: CreateFlags,
  collection: string,
  slug: string
): Promise<void> {
  const meta = parseSetPairs(flags.set);
  const result = await runCreate({
    cwd: flags.cwd,
    collection,
    slug,
    locale: flags.locale,
    meta,
    contentType: flags.type,
  });
  printResult(this, result, flags.format);
}

export const createCommandDef = buildCommand({
  func: create,
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
      set: setFlag,
      type: contentTypeFlag,
      format: outputFormatFlag,
    },
  },
  docs: {
    brief: "Create a new content item in a collection",
    fullDescription:
      "Create content with --set key=value (repeatable). Values are JSON-parsed when valid, otherwise used as strings.",
  },
});
