import { headers } from "next/headers";
import Link from "next/link";
import { DocumentEditor } from "./document-editor";

async function getContent(collectionName: string, file: string) {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3001";
  const proto = headersList.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;
  const res = await fetch(
    `${base}/api/documents/content?collection=${encodeURIComponent(collectionName)}&file=${encodeURIComponent(file)}`,
    { cache: "no-store" }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.error === "string" ? data.error : "Failed to load content";
    throw new Error(message);
  }
  return data as {
    meta: Record<string, unknown>;
    body: string;
    slug: string;
    locale: string | null;
    validation: { valid: boolean; errors: { field: string; message: string }[] };
  };
}

export default async function DocPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { name } = await params;
  const { file } = await searchParams;
  if (!file) {
    return (
      <div className="p-10">
        <p className="text-sm text-muted-foreground">Select a document from the collection.</p>
        <Link
          href={`/collections/${name}`}
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to collection
        </Link>
      </div>
    );
  }

  let data: Awaited<ReturnType<typeof getContent>>;
  try {
    data = await getContent(name, file);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load document.";
    return (
      <div className="p-10">
        <p className="text-sm text-destructive">{message}</p>
        <Link
          href={`/collections/${name}`}
          className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to collection
        </Link>
      </div>
    );
  }

  return (
    <DocumentEditor
      key={`${name}-${file}`}
      collection={name}
      file={file}
      initialMeta={data.meta}
      initialBody={data.body}
      initialValidation={data.validation}
      slug={data.slug}
      locale={data.locale}
      backHref={`/collections/${name}`}
    />
  );
}
