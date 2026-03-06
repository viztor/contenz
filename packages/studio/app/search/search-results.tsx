"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FileIcon = FileText as React.ComponentType<{ className?: string }>;

interface Result {
  collection: string;
  file: string;
  slug: string;
  locale?: string;
  excerpt: string;
}

export function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((data: { results?: Result[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setResults([]);
        } else {
          setResults(data.results ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Search failed");
          setResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (q === "") {
    return (
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        Enter a search term above or use the sidebar.
      </p>
    );
  }

  if (loading) {
    return <p className="mt-6 text-sm text-muted-foreground">Searching…</p>;
  }

  if (error) {
    return (
      <p className="mt-6 text-sm text-destructive">
        Search failed: {error}. Ensure the studio is run with a Contenz project (e.g.{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          contenz studio --cwd &lt;path&gt;
        </code>
        ).
      </p>
    );
  }

  const list = results ?? [];

  if (list.length === 0) {
    return <p className="mt-6 text-sm text-muted-foreground">No results found.</p>;
  }

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm text-muted-foreground">
        {list.length} result{list.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-2">
        {list.map((r, i) => (
          <Link
            key={`${r.collection}-${r.file}-${i}`}
            href={`/collections/${r.collection}/doc?file=${encodeURIComponent(r.file)}`}
          >
            <Card className="border-border/80 transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-2 py-3">
                <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  {r.collection} / {r.slug}
                  {r.locale ? ` (${r.locale})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0 text-xs leading-relaxed text-muted-foreground">
                {r.excerpt}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
