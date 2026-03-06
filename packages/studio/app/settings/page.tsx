"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfigData = {
  cwd: string;
  config: Record<string, unknown>;
} | null;

export default function SettingsPage() {
  const [data, setData] = useState<ConfigData>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/project/config")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load config");
        return res.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  if (error) {
    return (
      <div className="p-10">
        <p className="text-sm text-destructive">
          Could not load project config. Run the studio with CONTENZ_PROJECT_ROOT set.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Project settings</h1>
      <p className="mt-1 font-mono text-sm text-muted-foreground">{data.cwd}</p>

      <Card className="mt-6 border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">contenz.config</CardTitle>
          <p className="text-sm font-normal leading-relaxed text-muted-foreground">
            Resolved project configuration (read-only). Edit contenz.config.ts in your project to
            change.
          </p>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[60vh] overflow-x-auto overflow-y-auto rounded-lg bg-muted/50 p-4 font-mono text-xs leading-relaxed">
            {JSON.stringify(data.config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
