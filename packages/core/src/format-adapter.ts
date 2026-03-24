/**
 * FormatAdapter interface for extensible content format handling.
 *
 * Each adapter handles a set of file extensions and provides:
 * - extract: parse raw file content into meta + body
 * - serialize: convert meta + body back to file content
 *
 * Built-in adapter: json
 * External adapters: @contenz/adapter-mdx (md + mdx)
 */

export interface FormatAdapter {
  /** File extensions this adapter handles (without leading dot) */
  extensions: string[];
  /** Extract metadata and body from source content */
  extract(source: string, filePath: string): { meta: Record<string, unknown>; body?: string };
  /** Serialize metadata and body back to file content */
  serialize(meta: Record<string, unknown>, body?: string): string;
}

// ── JSON Adapter ────────────────────────────────────────────────────────────

export const jsonAdapter: FormatAdapter = {
  extensions: ["json"],

  extract(source: string): { meta: Record<string, unknown>; body?: string } {
    try {
      const parsed = JSON.parse(source);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return { meta: parsed as Record<string, unknown> };
      }
      return { meta: {} };
    } catch {
      return { meta: {} };
    }
  },

  serialize(meta: Record<string, unknown>): string {
    return `${JSON.stringify(meta, null, 2)}\n`;
  },
};

// ── Adapter Registry ────────────────────────────────────────────────────────

const adapterRegistry: FormatAdapter[] = [jsonAdapter];

/**
 * Register external format adapters (e.g. from @contenz/adapter-mdx).
 * Called during workspace creation with adapters from ContenzConfig.
 * New adapters are prepended so they take priority over built-ins.
 */
export function registerAdapters(adapters: FormatAdapter[]): void {
  for (const adapter of adapters) {
    // Avoid duplicates: remove existing adapters with overlapping extensions
    for (const ext of adapter.extensions) {
      const existing = adapterRegistry.findIndex((a) => a.extensions.includes(ext));
      if (existing !== -1) {
        adapterRegistry.splice(existing, 1);
      }
    }
    adapterRegistry.unshift(adapter);
  }
}

/**
 * Get the appropriate format adapter for a file extension.
 * Returns the first adapter whose extensions include the given ext.
 * Returns null if no adapter is registered for the extension.
 */
export function getAdapterForExtension(ext: string): FormatAdapter | null {
  const normalized = ext.startsWith(".") ? ext.slice(1) : ext;
  for (const adapter of adapterRegistry) {
    if (adapter.extensions.includes(normalized)) {
      return adapter;
    }
  }
  return null;
}
