"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SearchIcon = Search as React.ComponentType<{ className?: string }>;

export function SearchForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const initialQuery = searchParams.get("q") ?? "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement)?.value?.trim();
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          name="q"
          key={initialQuery}
          defaultValue={initialQuery}
          placeholder="Search documents…"
          className="h-10 rounded-lg border-border/80 bg-muted/50 pl-9 pr-4 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <Button type="submit" variant="secondary" size="default" className="h-10 rounded-lg px-4">
        Search
      </Button>
    </form>
  );
}
