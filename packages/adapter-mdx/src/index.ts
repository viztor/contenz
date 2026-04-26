/**
 * @contenz/adapter-mdx — Unified MD/MDX format adapter for contenz.
 *
 * Handles both .md and .mdx files. Auto-detects metadata syntax:
 *   - Frontmatter (--- YAML/JSON ---) — works in both .md and .mdx
 *   - Export const meta ({ export const meta = { ... } }) — MDX-specific
 *
 * Usage in contenz.config.ts:
 *   import { mdxAdapter } from "@contenz/adapter-mdx";
 *   export const config: ContenzConfig = { adapters: [mdxAdapter] };
 */

import type { FormatAdapter } from "@contenz/core";
import * as vm from "node:vm";

// ── Brace-Balanced Scanner (for `export const meta = { ... }`) ──────────────

const META_MARKER = "export const meta = ";

interface MetaSpan {
	markerStart: number;
	end: number;
	objectLiteral: string;
}

/**
 * Locate the `export const meta = { ... };` span in source.
 * Uses brace-balanced scanning that correctly handles nested braces,
 * string literals (single, double, backtick), and template interpolations.
 */
function findMetaSpan(source: string): MetaSpan | null {
	const markerStart = source.indexOf(META_MARKER);
	if (markerStart === -1) return null;

	let i = markerStart + META_MARKER.length;
	const len = source.length;

	while (i < len && /[\s\n]/.test(source[i])) i++;
	if (i >= len) return null;

	const open = source[i];
	if (open !== "{" && open !== "[") return null;

	const close = open === "{" ? "}" : "]";
	let depth = 1;
	const objectStart = i;
	i++;

	while (i < len && depth > 0) {
		const c = source[i];
		if (c === '"' || c === "'" || c === "`") {
			i = skipStringLiteral(source, i, len, c);
			continue;
		}
		if (c === open) depth++;
		else if (c === close) depth--;
		i++;
	}

	if (depth !== 0) return null;

	const objectLiteral = source.slice(objectStart, i);
	let end = i;
	while (end < len && source[end] !== ";" && /[\s]/.test(source[end])) end++;
	if (end < len && source[end] === ";") end++;

	return { markerStart, end, objectLiteral };
}

function skipStringLiteral(
	source: string,
	start: number,
	len: number,
	quote: string,
): number {
	let i = start + 1;
	while (i < len) {
		if (source[i] === "\\") {
			i += 2;
		} else if (
			quote === "`" &&
			source[i] === "$" &&
			i + 1 < len &&
			source[i + 1] === "{"
		) {
			i += 2;
			let depth = 1;
			while (i < len && depth > 0) {
				if (source[i] === "{") depth++;
				else if (source[i] === "}") depth--;
				else if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
					i = skipStringLiteral(source, i, len, source[i]);
					continue;
				}
				i++;
			}
		} else if (source[i] === quote) {
			return i + 1;
		} else {
			i++;
		}
	}
	return i;
}

function safeEvalObjectLiteral(objectStr: string): Record<string, unknown> {
	try {
		const code = `"use strict"; (${objectStr});`;
		const context = Object.create(null);
		const result = vm.runInNewContext(code, context, { timeout: 1000 });
		if (typeof result === "object" && result !== null) {
			return result as Record<string, unknown>;
		}
		return {};
	} catch (error) {
		return {};
	}
}

// ── Frontmatter parsing ─────────────────────────────────────────────────────

function parseFrontmatterYaml(source: string): Record<string, unknown> {
	const lines = source.split("\n");
	const result: Record<string, unknown> = {};

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#")) continue;

		const colonIdx = trimmed.indexOf(":");
		if (colonIdx === -1) continue;

		const key = trimmed.slice(0, colonIdx).trim();
		let value: unknown = trimmed.slice(colonIdx + 1).trim();

		if (value === "true") value = true;
		else if (value === "false") value = false;
		else if (value === "null") value = null;
		else if (
			typeof value === "string" &&
			value !== "" &&
			!Number.isNaN(Number(value))
		) {
			value = Number(value);
		} else if (
			typeof value === "string" &&
			((value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'")))
		) {
			value = value.slice(1, -1);
		} else if (
			typeof value === "string" &&
			value.startsWith("[") &&
			value.endsWith("]")
		) {
			try {
				value = JSON.parse(value);
			} catch {
				/* leave as string */
			}
		}

		result[key] = value;
	}

	return result;
}

function extractFrontmatterBlock(source: string): {
	frontmatter: string;
	body: string;
} {
	const trimmed = source.trim();
	if (!trimmed.startsWith("---")) {
		return { frontmatter: "", body: source };
	}
	const end = trimmed.indexOf("\n---", 3);
	if (end === -1) {
		return { frontmatter: trimmed.slice(3).trim(), body: "" };
	}
	return {
		frontmatter: trimmed.slice(3, end).trim(),
		body: trimmed.slice(end + 4).trimStart(),
	};
}

// ── Unified Adapter ─────────────────────────────────────────────────────────

/**
 * Unified MD/MDX format adapter.
 *
 * Handles both `.md` and `.mdx` files. Auto-detects metadata syntax:
 *   - Source starting with `---` → frontmatter (works in both .md and .mdx)
 *   - Source containing `export const meta = { ... }` → MDX export syntax
 */
export const mdxAdapter: FormatAdapter = {
	extensions: ["mdx", "md"],

	extract(source: string): { meta: Record<string, unknown>; body?: string } {
		// Frontmatter detection — works in both .md and .mdx files
		if (source.trimStart().startsWith("---")) {
			const { frontmatter, body } = extractFrontmatterBlock(source);
			let meta: Record<string, unknown>;
			try {
				meta = frontmatter ? JSON.parse(frontmatter) : {};
			} catch {
				meta = parseFrontmatterYaml(frontmatter);
			}
			return { meta, body };
		}

		// MDX export syntax: export const meta = { ... };
		const span = findMetaSpan(source);
		if (!span) return { meta: {}, body: source };

		const meta = safeEvalObjectLiteral(span.objectLiteral);
		const body = source.slice(span.end).trimStart();
		return { meta, body };
	},

	serialize(meta: Record<string, unknown>, body?: string): string {
		const metaBlock = `export const meta = ${JSON.stringify(meta, null, 2)};\n\n`;
		return metaBlock + (body ?? "");
	},
};

export type { FormatAdapter } from "@contenz/core";
