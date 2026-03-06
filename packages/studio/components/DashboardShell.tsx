"use client";

import { Languages, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FileTree } from "@/components/FileTree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SearchIcon = Search as React.ComponentType<{ className?: string }>;
const LangIcon = Languages as React.ComponentType<{ className?: string }>;
const SettingsIcon = Settings as React.ComponentType<{ className?: string }>;

type ProjectInfo = { cwd: string; collections: { name: string }[] } | null;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo>(null);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    fetch("/api/project")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProjectInfo) => setProject(data))
      .catch(() => setProject(null));
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQ.trim();
      if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    },
    [router, searchQ]
  );

  const projectLabel = project?.cwd
    ? project.cwd.split(/[/\\]/).filter(Boolean).slice(-2).join(" / ") || "Project"
    : "Contenz Studio";

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-border/80 bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Link
          href="/"
          className="shrink-0 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
        >
          {projectLabel}
        </Link>
        <form onSubmit={handleSearch} className="relative flex flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search documents…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="h-9 rounded-full border-border/80 bg-muted/50 pl-9 pr-4 text-sm transition-colors placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </form>
        <nav className="flex shrink-0 items-center gap-0.5">
          <Link href="/coverage">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
              title="i18n Coverage"
            >
              <LangIcon className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80"
              title="Project settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "flex w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border/80 bg-sidebar",
            "text-sidebar-foreground"
          )}
        >
          <div className="px-3 py-3">
            <span className="text-xs font-medium text-muted-foreground">Files</span>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <Suspense
              fallback={
                <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
              }
            >
              <FileTree />
            </Suspense>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
