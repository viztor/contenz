import { loadProjectConfig } from "@contenz/core/api";
import { NextResponse } from "next/server";

function serializableConfig(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === "function") continue;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = serializableConfig(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function GET() {
  const cwd = process.env.CONTENZ_PROJECT_ROOT || process.cwd();

  try {
    const config = await loadProjectConfig(cwd);
    const safe = serializableConfig(config as Record<string, unknown>);
    return NextResponse.json({ cwd, config: safe });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
