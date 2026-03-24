import fs from "node:fs/promises";
import path from "node:path";
import { defineCommand } from "citty";

const DEFAULT_CONTENT_DIR = "content";
const DEFAULT_COLLECTION = "pages";

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
	fields.push('  // extensions: ["md", "mdx"],');
	fields.push('  // ignore: ["README.md", "_*"],');

	return `import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
${fields.join("\n")}
};
`;
}

function renderSchemaFile(collection: string): string {
	const typeName = `${toPascalCase(collection)}Meta`;

	return `import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  summary: z.string(),
});

export const { meta, metaSchema, relations } = defineCollection({
  schema,
});

export type ${typeName} = z.infer<typeof meta>;
`;
}

function renderContentFile(locale?: "en" | "zh"): string {
	if (locale === "zh") {
		return `export const meta = {
  title: "欢迎使用 contenz",
  summary: "编辑这个示例条目来开始建立你自己的内容模型。",
};

这个示例文件可以直接通过 \`contenz lint\` 和 \`contenz build\`。
`;
	}

	return `export const meta = {
  title: "Welcome to contenz",
  summary: "Edit this starter entry to begin shaping your own content model.",
};

This starter file is here so \`contenz lint\` and \`contenz build\` work immediately.
`;
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
			await fs.readFile(path.join(cwd, "package.json"), "utf-8"),
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
	i18n: boolean;
}): ScaffoldFile[] {
	const collectionDir = path.join(
		options.cwd,
		options.contentDir,
		options.collection,
	);
	const files: ScaffoldFile[] = [
		{
			filePath: path.join(options.cwd, "contenz.config.ts"),
			content: renderConfigFile(options.contentDir, options.i18n),
		},
		{
			filePath: path.join(collectionDir, "schema.ts"),
			content: renderSchemaFile(options.collection),
		},
	];

	if (options.i18n) {
		files.push(
			{
				filePath: path.join(collectionDir, "welcome.en.mdx"),
				content: renderContentFile("en"),
			},
			{
				filePath: path.join(collectionDir, "welcome.zh.mdx"),
				content: renderContentFile("zh"),
			},
		);
	} else {
		files.push({
			filePath: path.join(collectionDir, "welcome.mdx"),
			content: renderContentFile(),
		});
	}

	return files;
}

export const initCommand = defineCommand({
	meta: {
		name: "init",
		description: "Scaffold contenz into an existing project",
	},
	args: {
		cwd: {
			type: "string",
			description: "Project root to scaffold into",
			default: ".",
		},
		dir: {
			type: "string",
			description:
				'Collection container directory to create (used as "<dir>/*")',
			default: DEFAULT_CONTENT_DIR,
		},
		collection: {
			type: "string",
			description: "Starter collection name",
			default: DEFAULT_COLLECTION,
		},
		i18n: {
			type: "boolean",
			description:
				"Scaffold starter locale files and enable i18n in contenz.config.ts",
			default: false,
		},
		force: {
			type: "boolean",
			description: "Overwrite scaffold files if they already exist",
			default: false,
		},
	},
	async run({ args }) {
		const cwd = path.resolve(args.cwd);
		const collection = args.collection.trim();
		const contentDir = args.dir.trim();

		if (!isRelativeProjectPath(contentDir)) {
			console.error(
				`Invalid --dir value: ${JSON.stringify(args.dir)}. Use a project-relative path like "content" or "src/content".`,
			);
			process.exit(1);
		}

		if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(collection)) {
			console.error(
				`Invalid --collection value: ${JSON.stringify(args.collection)}. Use letters, numbers, "-" or "_".`,
			);
			process.exit(1);
		}

		let cwdStat: Awaited<ReturnType<typeof fs.stat>>;
		try {
			cwdStat = await fs.stat(cwd);
		} catch {
			console.error(`Project root does not exist: ${cwd}`);
			process.exit(1);
		}

		if (!cwdStat.isDirectory()) {
			console.error(`Project root is not a directory: ${cwd}`);
			process.exit(1);
		}

		const files = getScaffoldFiles({
			cwd,
			contentDir,
			collection,
			i18n: args.i18n,
		});

		if (!args.force) {
			const conflicts: string[] = [];

			for (const file of files) {
				if (await pathExists(file.filePath)) {
					conflicts.push(path.relative(cwd, file.filePath));
				}
			}

			if (conflicts.length > 0) {
				console.error(
					"Cannot initialize contenz because these paths already exist:",
				);
				for (const conflict of conflicts) {
					console.error(`- ${conflict}`);
				}
				console.error("");
				console.error("Re-run with --force to overwrite them.");
				process.exit(1);
			}
		}

		for (const file of files) {
			await fs.mkdir(path.dirname(file.filePath), { recursive: true });
			await fs.writeFile(file.filePath, file.content, "utf-8");
		}

		const installCommand = await detectInstallCommand(cwd);

		console.log(`Initialized contenz in ${cwd}`);
		console.log("");
		console.log("Created:");
		for (const file of files) {
			console.log(`- ${path.relative(cwd, file.filePath)}`);
		}
		console.log("");
		console.log("Next steps:");
		console.log(`1. Install schema dependencies if needed: ${installCommand}`);
		console.log("2. Run `contenz lint`");
		console.log("3. Run `contenz build`");
	},
});
