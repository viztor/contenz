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
      description: "Contenz source directory to build",
      default: "content",
    },
    cwd: {
      type: "string",
      description: "Project root (where contenz.config.ts lives)",
      default: ".",
    },
  },
  async run({ args }) {
    const result = await runBuild({
      cwd: args.cwd,
      dir: args.dir,
    });
    console.log(result.report);
    process.exit(result.success ? 0 : 1);
  },
});
