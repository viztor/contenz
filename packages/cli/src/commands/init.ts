import fs from "node:fs/promises";
import path from "node:path";

import { buildCommand } from "@stricli/core";

import type { ContenzContext } from "../context.js";
import { fail, log } from "../output.js";
import { cwdFlag, forceFlag } from "../shared.js";

const DEFAULT_CONTENT_DIR = "content";
const DEFAULT_PRESET = "minimal";

interface ScaffoldFile {
  filePath: string;
  content: string;
}

function isRelativeProjectPath(value: string): boolean {
  if (value.length === 0 || path.isAbsolute(value)) {
    return false;
  }

  const normalized = path.normalize(value);
  return normalized !== ".." && !normalized.startsWith(`..${path.sep}`);
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join("");
}

function renderConfigFile(contentDir: string, i18n: boolean): string {
  const fields: string[] = [];

  fields.push(`  sources: [${JSON.stringify(`${contentDir}/*`)}],`);

  if (i18n) {
    fields.push("  i18n: true,");
  }

  fields.push('  // outputDir: "generated/content",');
  fields.push('  // coveragePath: "contenz.coverage.md",');
  fields.push("  // strict: false,");
  fields.push('  // extensions: ["md", "mdx", "json"],');
  fields.push('  // ignore: ["README.md", "_*"],');

  return `import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
${fields.join("\n")}
};
`;
}

function renderSchemaFile(collection: string, preset: string): string {
  const typeName = `${toPascalCase(collection)}Meta`;

  if (preset === "blog") {
    return `import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  title: z.string().describe("The post title"),
  date: z.date().describe("Publish date"),
  tags: z.array(z.string()).optional().describe("Tags for the post"),
});

export const { meta, relations } = defineCollection({
  schema,
});

export type ${typeName} = z.infer<typeof meta>;
`;
  }

  // Minimal preset
  return `import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  summary: z.string(),
});

export const { meta, relations } = defineCollection({
  schema,
});

export type ${typeName} = z.infer<typeof meta>;
`;
}

function renderContentFile(preset: string, locale?: "en" | "zh"): string {
  if (preset === "blog") {
    if (locale === "zh") {
      return JSON.stringify(
        {
          title: "我的第一篇博客",
          date: new Date().toISOString().split("T")[0],
          tags: ["更新", "欢迎"],
        },
        null,
        2
      );
    }
    return JSON.stringify(
      {
        title: "My First Blog Post",
        date: new Date().toISOString().split("T")[0],
        tags: ["update", "welcome"],
      },
      null,
      2
    );
  }

  // Minimal preset
  if (locale === "zh") {
    return JSON.stringify(
      {
        title: "欢迎使用 contenz",
        summary: "编辑这个示例条目来开始建立你自己的内容模型。",
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      title: "Welcome to contenz",
      summary:
        "Edit this starter entry to begin shaping your own content model.",
    },
    null,
    2
  );
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function detectInstallCommand(cwd: string): Promise<string> {
  try {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(cwd, "package.json"), "utf-8")
    ) as {
      packageManager?: string;
    };

    if (packageJson.packageManager?.startsWith("pnpm")) {
      return "pnpm add @contenz/core zod";
    }

    if (packageJson.packageManager?.startsWith("yarn")) {
      return "yarn add @contenz/core zod";
    }

    if (packageJson.packageManager?.startsWith("bun")) {
      return "bun add @contenz/core zod";
    }
  } catch {}

  return "npm install @contenz/core zod";
}

function getScaffoldFiles(options: {
  cwd: string;
  contentDir: string;
  collection: string;
  preset: string;
  i18n: boolean;
}): ScaffoldFile[] {
  const collectionDir = path.join(
    options.cwd,
    options.contentDir,
    options.collection
  );
  const files: ScaffoldFile[] = [
    {
      filePath: path.join(options.cwd, "contenz.config.ts"),
      content: renderConfigFile(options.contentDir, options.i18n),
    },
    {
      filePath: path.join(collectionDir, "schema.ts"),
      content: renderSchemaFile(options.collection, options.preset),
    },
  ];

  if (options.i18n) {
    files.push(
      {
        filePath: path.join(collectionDir, "welcome.en.json"),
        content: renderContentFile(options.preset, "en"),
      },
      {
        filePath: path.join(collectionDir, "welcome.zh.json"),
        content: renderContentFile(options.preset, "zh"),
      }
    );
  } else {
    files.push({
      filePath: path.join(collectionDir, "welcome.json"),
      content: renderContentFile(options.preset),
    });
  }

  return files;
}

interface InitFlags {
  cwd: string;
  dir: string;
  collection?: string;
  preset: "minimal" | "blog";
  i18n: boolean;
  force: boolean;
}

async function init(this: ContenzContext, flags: InitFlags): Promise<void> {
  const cwd = path.resolve(flags.cwd);
  const preset = flags.preset;
  let collection = flags.collection?.trim();
  let contentDir = flags.dir?.trim();

  // Framework detection for default dir
  if (!contentDir || contentDir === DEFAULT_CONTENT_DIR) {
    const hasSrc = await pathExists(path.join(cwd, "src"));
    contentDir = hasSrc ? "src/content" : "content";
  }

  if (!collection) {
    collection = preset === "blog" ? "blog" : "pages";
  }

  if (!isRelativeProjectPath(contentDir)) {
    fail.call(
      this,
      `Invalid --dir value: ${JSON.stringify(flags.dir)}. Use a project-relative path like "content" or "src/content".`
    );
    return;
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(collection)) {
    fail.call(
      this,
      `Invalid --collection value: ${JSON.stringify(flags.collection)}. Use letters, numbers, "-" or "_".`
    );
    return;
  }

  let cwdStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    cwdStat = await fs.stat(cwd);
  } catch {
    fail(this, `Project root does not exist: ${cwd}`);
    return;
  }

  if (!cwdStat.isDirectory()) {
    fail(this, `Project root is not a directory: ${cwd}`);
    return;
  }

  const files = getScaffoldFiles({
    cwd,
    contentDir,
    collection,
    preset,
    i18n: flags.i18n,
  });

  if (!flags.force) {
    const conflicts: string[] = [];

    for (const file of files) {
      if (await pathExists(file.filePath)) {
        conflicts.push(path.relative(cwd, file.filePath));
      }
    }

    if (conflicts.length > 0) {
      fail.call(
        this,
        "Cannot initialize contenz because these paths already exist:"
      );
      for (const conflict of conflicts) {
        logError(this, `- ${conflict}`);
      }
      logError(this, "");
      logError(this, "Re-run with --force to overwrite them.");
      return;
    }
  }

  for (const file of files) {
    await fs.mkdir(path.dirname(file.filePath), { recursive: true });
    await fs.writeFile(file.filePath, file.content, "utf-8");
  }

  const installCommand = await detectInstallCommand(cwd);

  log(this, `Initialized contenz in ${cwd}`);
  log(this, "");
  log(this, "Created:");
  for (const file of files) {
    log(this, `- ${path.relative(cwd, file.filePath)}`);
  }
  log(this, "");
  log(this, "Next steps:");
  log(this, `1. Install schema dependencies if needed: ${installCommand}`);
  log(this, "2. Run `contenz lint`");
  log(this, "3. Run `contenz build`");
}

function logError(ctx: ContenzContext, message: string): void {
  ctx.process.stderr.write(`${message}\n`);
}

export const initCommandDef = buildCommand({
  func: init,
  parameters: {
    flags: {
      cwd: cwdFlag,
      dir: {
        kind: "parsed",
        brief: 'Collection container directory to create (used as "<dir>/*")',
        parse: String,
        default: DEFAULT_CONTENT_DIR,
        placeholder: "dir",
      },
      collection: {
        kind: "parsed",
        brief:
          "Starter collection name (defaults to 'blog' if preset=blog, else 'pages')",
        parse: String,
        optional: true,
        placeholder: "name",
      },
      preset: {
        kind: "enum",
        values: ["minimal", "blog"] as const,
        brief: "Starter schema preset: minimal, blog",
        default: DEFAULT_PRESET,
      },
      i18n: {
        kind: "boolean",
        brief:
          "Scaffold starter locale files and enable i18n in contenz.config.ts",
        default: false,
      },
      force: forceFlag,
    },
  },
  docs: {
    brief: "Scaffold contenz into an existing project",
  },
});
