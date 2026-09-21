import { runExport } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { printResult } from "../output.js";
import {
  cwdFlag,
  localeFlag,
  outputFormatFlag,
  type OutputFormat,
} from "../shared.js";

interface ExportFlags {
  cwd: string;
  format: "messages" | "xliff";
  collection?: string;
  locale?: string;
  outDir?: string;
  output: OutputFormat;
}

async function exportContent(
  this: ContenzContext,
  flags: ExportFlags
): Promise<void> {
  const result = await runExport({
    cwd: flags.cwd,
    format: flags.format,
    collection: flags.collection,
    locale: flags.locale,
    outDir: flags.outDir,
  });
  printResult(
    this,
    {
      success: result.success,
      data: { files: result.files },
      error: result.success ? undefined : `${result.errors} export error(s)`,
      diagnostics: result.diagnostics.map((d) => ({
        field: d.field,
        message: d.message,
      })),
    },
    flags.output
  );
}

export const exportCommandDef = buildCommand({
  func: exportContent,
  parameters: {
    flags: {
      cwd: cwdFlag,
      format: {
        kind: "enum",
        values: ["messages", "xliff"] as const,
        brief: "Export format: messages (default) or xliff",
        default: "messages",
      },
      collection: {
        kind: "parsed",
        brief: "Only export this collection or single",
        parse: String,
        optional: true,
        placeholder: "name",
      },
      locale: localeFlag,
      outDir: {
        kind: "parsed",
        brief: "Output directory (default: ./messages or ./xliff)",
        parse: String,
        optional: true,
        placeholder: "dir",
      },
      output: outputFormatFlag,
    },
  },
  docs: {
    brief: "Export translations for TMS/i18n workflows",
    fullDescription:
      "Flatten content to per-locale JSON messages (next-intl/Paraglide) or XLIFF 1.2 per target locale (Crowdin/Lokalise/Phrase). Export only; importing translations back is not supported yet.",
  },
});
