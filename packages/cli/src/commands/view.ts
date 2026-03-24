import { runView } from "@contenz/core/api";
import { defineCommand } from "citty";
import { printAndExit } from "../output.js";

export const viewCommand = defineCommand({
	meta: {
		name: "view",
		description: "View a content item by collection and slug",
	},
	args: {
		collection: {
			type: "positional",
			description: "Collection name",
			required: true,
		},
		slug: {
			type: "positional",
			description: "Content slug",
			required: true,
		},
		locale: {
			type: "string",
			description: "Locale to read (defaults to default locale)",
			required: false,
		},
		cwd: {
			type: "string",
			description: "Project root",
			default: ".",
		},
		format: {
			type: "string",
			description: "Output format: json or pretty",
			default: "json",
		},
	},
	async run({ args }) {
		const result = await runView({
			cwd: args.cwd,
			collection: args.collection,
			slug: args.slug,
			locale: args.locale,
		});
		printAndExit(result, args.format);
	},
});
