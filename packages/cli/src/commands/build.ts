import { defineCommand } from "citty";
import { runBuild } from "@contenz/core/api";

export const buildCommand = defineCommand({
  meta: {
    name: "build",
    description: "Generate content data files",
  },
  args: {
    dir: {
      type: "string",
      description: 'Legacy source root override (treated as "<dir>/*")',
      required: false,
    },
    cwd: {
      type: "string",
      description: "Project root (where contenz.config.ts lives)",
      default: ".",
    },
    format: {
      type: "string",
      description: "Diagnostic formatter: pretty, json, or github",
      default: "pretty",
    },
  },
  async run({ args }) {
    const result = await runBuild({
      cwd: args.cwd,
      dir: args.dir,
      format: args.format as "pretty" | "json" | "github",
    });
    console.log(result.report);
    process.exit(result.success ? 0 : 1);
  },
});
