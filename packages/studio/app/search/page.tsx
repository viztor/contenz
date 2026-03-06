import { Suspense } from "react";
import { SearchForm } from "./search-form";
import { SearchResults } from "./search-results";

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-2xl p-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Search</h1>
      <p className="mt-1 text-sm text-muted-foreground">Find documents by content or metadata.</p>
      <div className="mt-6">
        <Suspense fallback={null}>
          <SearchForm />
          <SearchResults />
        </Suspense>
      </div>
    </div>
  );
}
