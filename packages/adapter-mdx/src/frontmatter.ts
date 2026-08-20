/**
 * Frontmatter parser for MD/MDX.
 *
 * Handles JSON documents and the YAML-ish subset authors actually write:
 * scalars, quoted strings, inline JSON, multiline JSON-ish values (including
 * trailing commas), YAML dash lists, indented maps, and `|` / `>` scalars.
 */

const KEY = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/;
const BLOCK_SCALAR = /^[|>][+-]?\s*(?:\n|$)/;
const NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const FLOW_KEY = /([{[,]\s*)([A-Za-z_][\w-]*)\s*:/g;
const TRAILING_COMMA = /,(\s*[}\]])/g;
const DASH_PREFIX = /^(\s*-\s+)/;
const URL_SCHEME = /^[A-Za-z][\w+.-]*:\/\//;

export function parseFrontmatter(source: string): Record<string, unknown> {
  const trimmed = source.trim();
  if (!trimmed) return {};

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isPlainObject(parsed)) return parsed;
  } catch {
    // YAML-ish frontmatter below.
  }

  return parseFrontmatterYaml(trimmed);
}

function parseFrontmatterYaml(source: string): Record<string, unknown> {
  const lines = source.split(/\r?\n/);
  const result: Record<string, unknown> = {};
  const firstKey = lines.find((line) => isKeyLine(line));
  const baseIndent = firstKey == null ? 0 : lineIndent(firstKey);

  for (let index = 0; index < lines.length;) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      index += 1;
      continue;
    }

    if (lineIndent(line) !== baseIndent) {
      index += 1;
      continue;
    }

    const match = KEY.exec(trimmed);
    if (!match) {
      index += 1;
      continue;
    }

    const key = match[1];
    const inline = match[2] ?? "";
    let nextIndex = index + 1;

    if (needsContinuation(inline)) {
      while (nextIndex < lines.length) {
        const next = lines[nextIndex] ?? "";
        const nextTrimmed = next.trim();
        if (nextTrimmed === "" || nextTrimmed.startsWith("#")) {
          nextIndex += 1;
          continue;
        }
        if (lineIndent(next) <= baseIndent && KEY.test(nextTrimmed)) {
          break;
        }
        nextIndex += 1;
      }
      result[key] = parseFrontmatterValue(
        [inline, ...lines.slice(index + 1, nextIndex)].join("\n")
      );
    } else {
      result[key] = parseFrontmatterValue(inline);
    }

    index = nextIndex;
  }

  return result;
}

function parseFrontmatterValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = tryParseJsonish(trimmed);
    if (parsed.ok) return parsed.value;
  }

  if (BLOCK_SCALAR.test(trimmed)) {
    return parseBlockScalar(trimmed);
  }

  if (isDashList(value)) {
    return parseDashList(value);
  }

  if (isNestedMap(value)) {
    return parseFrontmatterYaml(value);
  }

  return parseScalar(stripUnquotedComment(trimmed));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function lineIndent(line: string): number {
  return /^ */.exec(line)?.[0].length ?? 0;
}

function isKeyLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed !== "" && !trimmed.startsWith("#") && KEY.test(trimmed);
}

function needsContinuation(inline: string): boolean {
  const trimmed = inline.trim();
  if (trimmed === "") return true;
  if (/^[|>][+-]?$/.test(trimmed)) return true;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return !tryParseJsonish(trimmed).ok;
  }
  return false;
}

function tryParseJsonish(
  value: string
): { ok: true; value: unknown } | { ok: false } {
  const stripped = value.replaceAll(TRAILING_COMMA, "$1");
  const candidates = [value, stripped];
  const withQuotedKeys = stripped.replaceAll(FLOW_KEY, '$1"$2":');
  if (withQuotedKeys !== stripped) candidates.push(withQuotedKeys);

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {
      // try the next candidate
    }
  }

  return { ok: false };
}

function parseScalar(trimmed: string): unknown {
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;

  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  if (NUMBER.test(trimmed)) return Number(trimmed);

  return trimmed;
}

function stripUnquotedComment(value: string): string {
  if (value.includes("\n")) return value;
  if (value.startsWith('"') || value.startsWith("'")) return value;
  const hash = value.indexOf(" #");
  if (hash === -1) return value;
  return value.slice(0, hash).trimEnd();
}

function isDashList(value: string): boolean {
  const first = value
    .split("\n")
    .find((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  return first != null && DASH_PREFIX.test(first);
}

function parseDashList(value: string): unknown[] {
  const items: string[] = [];
  let current: string | null = null;
  let valueColumn = 0;

  for (const line of value.split("\n")) {
    const prefix = DASH_PREFIX.exec(line);
    if (prefix) {
      if (current !== null) items.push(current);
      current = line.slice(prefix[1].length);
      valueColumn = prefix[1].length;
    } else if (current !== null) {
      const stripped =
        line.length >= valueColumn ? line.slice(valueColumn) : line.trimStart();
      current += `\n${stripped}`;
    }
  }
  if (current !== null) items.push(current);

  return items.map((item) => parseFrontmatterValue(item));
}

function isNestedMap(value: string): boolean {
  const lines = value
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));
  if (lines.length === 0) return false;
  const first = lines[0]?.trim() ?? "";
  if (URL_SCHEME.test(first)) return false;
  if (!KEY.test(first)) return false;

  return lines.every((line) => {
    const trimmedLine = line.trimStart();
    return KEY.test(trimmedLine) || /^\s+/.test(line);
  });
}

function parseBlockScalar(value: string): string {
  const newline = value.indexOf("\n");
  if (newline === -1) return "";
  const folded = value.trimStart().startsWith(">");
  const text = dedent(value.slice(newline + 1)).replace(/\n+$/, "");
  if (!folded) return text;
  return text.replaceAll(/\n(?!\n)/g, " ");
}

function dedent(text: string): string {
  const lines = text.split("\n");
  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => lineIndent(line));
  if (indents.length === 0) return text;
  const min = Math.min(...indents);
  if (min === 0) return text;
  return lines
    .map((line) => (line.length >= min ? line.slice(min) : line))
    .join("\n");
}
