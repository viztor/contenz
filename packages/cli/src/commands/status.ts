import { defineCommand } from "citty";
import { runStatus } from "@contenz/core/api";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description: "Report whether build is up to date or needs rebuild",
  },
  args: {
    cwd: {
      type: "string",
      description: "Project root (where contenz.config.ts lives)",
      default: ".",
    },
  },
  async run({ args }) {
    const result = await runStatus({ cwd: args.cwd });
    console.log(result.message);
    if (result.dirtyCollections.length > 0) {
      console.log("Would rebuild:", result.dirtyCollections.join(", "));
    }
    if (result.freshCollections.length > 0) {
      console.log("Up to date:", result.freshCollections.join(", "));
    }
    process.exit(result.status === "needs-build" ? 1 : 0);
  },
});
