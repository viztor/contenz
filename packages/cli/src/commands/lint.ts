import { defineCommand } from "citty";
import { runLint } from "@contenz/core/api";

export const lintCommand = defineCommand({
  meta: {
    name: "lint",
    description: "Validate content files against their schemas",
  },
  args: {
    dir: {
      type: "string",
      description: 'Legacy source root override (treated as "<dir>/*")',
      required: false,
    },
    collection: {
      type: "string",
      description: "Specific collection to lint (optional)",
      required: false,
    },
    cwd: {
      type: "string",
      description: "Project root (where contenz.config.ts lives)",
      default: ".",
    },
    coverage: {
      type: "boolean",
      description: "Write coverage report file (e.g. contenz.coverage.md)",
      default: false,
    },
    "dry-run": {
      type: "boolean",
      description: "Report only; do not write coverage report file",
      default: false,
    },
    format: {
      type: "string",
      description: "Diagnostic formatter: pretty, json, or github",
      default: "pretty",
    },
  },
  async run({ args }) {
    const result = await runLint({
      cwd: args.cwd,
      dir: args.dir,
      collection: args.collection,
      coverage: args.coverage,
      dryRun: args["dry-run"],
      format: args.format as "pretty" | "json" | "github",
    });
    console.log(result.report);
    process.exit(result.success ? 0 : 1);
  },
});
