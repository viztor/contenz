import { defineCommand } from "citty";
import { runLint } from "../run-lint.js";

export const lintCommand = defineCommand({
  meta: {
    name: "lint",
    description: "Validate content files against their schemas",
  },
  args: {
    dir: {
      type: "string",
      description: "Content directory to lint",
      default: "content",
    },
    collection: {
      type: "string",
      description: "Specific collection to lint (optional)",
      required: false,
    },
    cwd: {
      type: "string",
      description: "Project root (where content.config.ts lives)",
      default: ".",
    },
    coverage: {
      type: "boolean",
      description: "Write coverage report file (e.g. content.coverage.md)",
      default: false,
    },
  },
  async run({ args }) {
    const result = await runLint({
      cwd: args.cwd,
      dir: args.dir,
      collection: args.collection,
      coverage: args.coverage,
    });
    console.log(result.report);
    process.exit(result.success ? 0 : 1);
  },
});
