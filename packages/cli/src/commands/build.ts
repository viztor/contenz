import { runBuild } from "@contenz/core/api";
import { defineCommand } from "citty";

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
		force: {
			type: "boolean",
			description: "Rebuild all collections, ignore manifest cache",
			default: false,
		},
		"dry-run": {
			type: "boolean",
			description: "Report what would be generated without writing files",
			default: false,
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
			force: args.force,
			dryRun: args["dry-run"],
			format: args.format as "pretty" | "json" | "github",
		});
		console.log(result.report);
		process.exit(result.success ? 0 : 1);
	},
});
