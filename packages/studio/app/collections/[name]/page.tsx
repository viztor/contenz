import { FileText } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FileIcon = FileText as React.ComponentType<{ className?: string }>;

async function getDocuments(collectionName: string) {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3001";
  const proto = headersList.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;
  const res = await fetch(
    `${base}/api/documents?collection=${encodeURIComponent(collectionName)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to load documents");
  return res.json() as Promise<{
    collection: string;
    documents: { slug: string; file: string; locale?: string }[];
  }>;
}

export default async function CollectionPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  let data: { collection: string; documents: { slug: string; file: string; locale?: string }[] };
  try {
    data = await getDocuments(name);
  } catch {
    return (
      <div className="p-10">
        <p className="text-sm text-destructive">Could not load collection.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-10">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Collection: {data.collection}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {data.documents.length} document{data.documents.length !== 1 ? "s" : ""}
      </p>
      <div className="space-y-2">
        {data.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents.</p>
        ) : (
          data.documents.map((doc) => (
            <Link
              key={doc.file}
              href={`/collections/${name}/doc?file=${encodeURIComponent(doc.file)}`}
            >
              <Card className="border-border/80 transition-colors hover:bg-muted/50">
                <CardHeader className="flex flex-row items-center gap-2 py-4">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">{doc.slug}</CardTitle>
                  {doc.locale && (
                    <span className="text-xs text-muted-foreground">{doc.locale}</span>
                  )}
                </CardHeader>
                <CardContent className="pb-4 pt-0 font-mono text-xs text-muted-foreground">
                  {doc.file}
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
