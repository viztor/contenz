import { defineCommand } from "citty";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const studioCommand = defineCommand({
  meta: {
    name: "studio",
    description: "Start the Contenz Authoring Studio (Next.js app)",
  },
  args: {
    cwd: {
      type: "string",
      description: "Project root (content sources and contenz.config)",
      default: ".",
    },
    port: {
      type: "string",
      description: "Port for the studio dev server",
      default: "3001",
    },
  },
  async run({ args }) {
    const projectRoot = path.resolve(process.cwd(), args.cwd);
    const studioPkgUrl = await import.meta.resolve("@contenz/studio/package.json");
    const studioDir = path.dirname(fileURLToPath(studioPkgUrl));
    const env = {
      ...process.env,
      CONTENZ_PROJECT_ROOT: projectRoot,
    };

    const child = spawn("npm", ["run", "dev", "--", "--port", args.port], {
      cwd: studioDir,
      env,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (err) => {
      console.error("Failed to start studio:", err);
      process.exit(1);
    });

    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  },
});
