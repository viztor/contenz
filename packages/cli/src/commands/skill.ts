import { runSkill } from "@contenz/core/api";
import { defineCommand } from "citty";
import { printAndExit } from "../output.js";

export const skillCommand = defineCommand({
  meta: {
    name: "skill",
    description: "Generate an AI agent SKILL.md file for the current project",
  },
  args: {
    cwd: {
      type: "string",
      description: "Project root",
      default: ".",
    },
    format: {
      type: "string",
      description: "Output format: json, md (default is md)",
      default: "md",
    },
  },
  async run({ args }) {
    const result = await runSkill(args.cwd);
    
    if (args.format === "json") {
      printAndExit(result, "json");
    } else {
      if (result.success && result.data) {
        console.log(result.data);
        process.exit(0);
      } else {
        console.error("Failed to generate skill:", result.error);
        process.exit(1);
      }
    }
  },
});
