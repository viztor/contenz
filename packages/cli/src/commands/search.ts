import { runSearch } from "@contenz/core/api";
import { defineCommand } from "citty";
import { printAndExit } from "../output.js";

/** Parse --field flags into a Record */
function parseFieldFlags(
	fieldArg: string | string[] | undefined,
): Record<string, string> {
	const fields: Record<string, string> = {};
	if (!fieldArg) return fields;

	const pairs = Array.isArray(fieldArg) ? fieldArg : [fieldArg];
	for (const pair of pairs) {
		const eqIdx = pair.indexOf("=");
		if (eqIdx === -1) {
			throw new Error(`Invalid --field format: "${pair}". Expected key=value`);
		}
		fields[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
	}
	return fields;
}

export const searchCommand = defineCommand({
	meta: {
		name: "search",
		description: "Search content items in a collection by slug or field values",
	},
	args: {
		collection: {
			type: "positional",
			description: "Collection name",
			required: true,
		},
		query: {
			type: "positional",
			description: "Substring to match against slugs (optional)",
			required: false,
		},
		field: {
			type: "string",
			description: "Filter by field value (key=value), repeatable",
			required: false,
		},
		locale: {
			type: "string",
			description: "Filter by locale (for i18n collections)",
			required: false,
		},
		limit: {
			type: "string",
			description: "Maximum number of results (default: 50)",
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
		const fields = parseFieldFlags(args.field as string | string[] | undefined);
		const result = await runSearch({
			cwd: args.cwd,
			collection: args.collection,
			query: args.query || undefined,
			fields: Object.keys(fields).length > 0 ? fields : undefined,
			locale: args.locale,
			limit: args.limit ? Number.parseInt(args.limit, 10) : undefined,
		});
		printAndExit(result, args.format);
	},
});
