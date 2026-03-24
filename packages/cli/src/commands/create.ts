import { runCreate } from "@contenz/core/api";
import { defineCommand } from "citty";
import { printAndExit } from "../output.js";

/** Parse citty's --set arg (single string or array) into a Record */
function parseSetFlags(
	setArg: string | string[] | undefined,
): Record<string, unknown> {
	const meta: Record<string, unknown> = {};
	if (!setArg) return meta;

	const pairs = Array.isArray(setArg) ? setArg : [setArg];
	for (const pair of pairs) {
		const eqIdx = pair.indexOf("=");
		if (eqIdx === -1) {
			throw new Error(`Invalid --set format: "${pair}". Expected key=value`);
		}
		const key = pair.slice(0, eqIdx);
		const rawValue = pair.slice(eqIdx + 1);
		try {
			meta[key] = JSON.parse(rawValue);
		} catch {
			meta[key] = rawValue;
		}
	}
	return meta;
}

export const createCommand = defineCommand({
	meta: {
		name: "create",
		description: "Create a new content item in a collection",
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
			description: "Locale for the content item",
			required: false,
		},
		set: {
			type: "string",
			description: "Set field values (key=value), repeatable",
			required: false,
		},
		type: {
			type: "string",
			description: "Content type (for multi-type collections)",
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
		const meta = parseSetFlags(args.set as string | string[] | undefined);
		const result = await runCreate({
			cwd: args.cwd,
			collection: args.collection,
			slug: args.slug,
			locale: args.locale,
			meta,
			contentType: args.type,
		});
		printAndExit(result, args.format);
	},
});
