import { runSkill } from "@contenz/core/api";
import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { fail, log, printResult } from "../output.js";
import { cwdFlag, type SkillFormat } from "../shared.js";

interface SkillFlags {
  cwd: string;
  format: SkillFormat;
}

async function skill(this: ContenzContext, flags: SkillFlags): Promise<void> {
  const result = await runSkill(flags.cwd);

  if (flags.format === "json") {
    printResult(this, result, "json");
    return;
  }

  if (result.success && result.data) {
    log(this, result.data);
  } else {
    fail(this, `Failed to generate skill: ${result.error}`);
  }
}

export const skillCommandDef = buildCommand({
  func: skill,
  parameters: {
    flags: {
      cwd: cwdFlag,
      format: {
        kind: "enum",
        values: ["md", "json"] as const,
        brief: "Output format: md (default) or json",
        default: "md",
      },
    },
  },
  docs: {
    brief: "Generate an AI agent SKILL.md file for the current project",
  },
});
