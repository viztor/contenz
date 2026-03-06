"use client";

import { ChevronRight, FileText, Folder } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const FolderIcon = Folder as React.ComponentType<{ className?: string }>;
const FileIcon = FileText as React.ComponentType<{ className?: string }>;
const ChevronIcon = ChevronRight as React.ComponentType<{ className?: string }>;

type TreeData = {
  cwd: string;
  collections: {
    name: string;
    documents: { file: string; slug: string; locale?: string }[];
  }[];
};

export function FileTree() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFile = searchParams.get("file");
  const [data, setData] = useState<TreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openCollections, setOpenCollections] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/tree")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load tree");
        return res.json();
      })
      .then((json: TreeData) => {
        setData(json);
        setOpenCollections(new Set(json.collections.map((c) => c.name)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, []);

  const toggleCollection = (name: string) => {
    setOpenCollections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (error) {
    return (
      <div className="rounded-lg bg-muted/50 px-3 py-3 text-sm text-muted-foreground">
        Project not loaded. Set CONTENZ_PROJECT_ROOT.
      </div>
    );
  }

  if (!data) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {data.collections.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted-foreground">No collections</p>
      ) : (
        data.collections.map((coll) => {
          const isOpen = openCollections.has(coll.name);
          return (
            <Collapsible
              key={coll.name}
              open={isOpen}
              onOpenChange={() => toggleCollection(coll.name)}
            >
              <CollapsibleTrigger
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
                )}
              >
                <ChevronIcon
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-90"
                  )}
                />
                <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{coll.name}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-1 mt-0.5 space-y-0.5 border-l border-sidebar-border/60 pl-3">
                  {coll.documents.length === 0 ? (
                    <p className="py-1.5 text-xs text-muted-foreground">No documents</p>
                  ) : (
                    coll.documents.map((doc) => {
                      const href = `/collections/${coll.name}/doc?file=${encodeURIComponent(doc.file)}`;
                      const isActive =
                        pathname === `/collections/${coll.name}/doc` && currentFile === doc.file;
                      return (
                        <Link
                          key={doc.file}
                          href={href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                            isActive &&
                              "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          )}
                        >
                          <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {doc.slug}
                            {doc.locale ? (
                              <span className="ml-1 text-muted-foreground">({doc.locale})</span>
                            ) : null}
                          </span>
                        </Link>
                      );
                    })
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })
      )}
    </div>
  );
}
