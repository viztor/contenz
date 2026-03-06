import { headers } from "next/headers";
import { Card, CardContent } from "@/components/ui/card";

async function getProject() {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3001";
  const proto = headersList.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/project`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load project");
  return res.json() as Promise<{
    cwd: string;
    collections: { name: string; collectionPath: string }[];
  }>;
}

export default async function HomePage() {
  let project: { cwd: string; collections: { name: string }[] };
  try {
    project = await getProject();
  } catch (_e) {
    return (
      <div className="p-10">
        <Card className="max-w-xl border-destructive/30 bg-destructive/5 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed text-destructive">
              Could not load project. Run the studio from a Contenz project with{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                contenz studio
              </code>{" "}
              or set{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                CONTENZ_PROJECT_ROOT
              </code>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-10">
      <Card className="border-border/80 shadow-sm">
        <CardContent className="pt-8 pb-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Welcome to Contenz Studio
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Select a document from the file tree on the left to edit. Use the search bar above to
            find content, or open <strong>Coverage</strong> for i18n status and translations.
          </p>
          <p className="mt-5 font-mono text-xs text-muted-foreground">{project.cwd}</p>
          {project.collections.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {project.collections.length} collection
              {project.collections.length !== 1 ? "s" : ""} in this project.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
