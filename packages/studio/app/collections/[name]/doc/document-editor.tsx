"use client";

import { AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import { BodyEditor } from "@/components/BodyEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";

const AlertIcon = AlertCircle as React.ComponentType<{ className?: string }>;
const ChevronDownIcon = ChevronDown as React.ComponentType<{ className?: string }>;
const ChevronRightIcon = ChevronRight as React.ComponentType<{ className?: string }>;

function metaValueToString(v: unknown): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function parseMetaValue(s: string): unknown {
  const t = s.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (t === "null") return null;
  const n = Number(t);
  if (!Number.isNaN(n)) return n;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

export interface DocumentEditorProps {
  collection: string;
  file: string;
  initialMeta: Record<string, unknown>;
  initialBody: string;
  initialValidation: { valid: boolean; errors: { field: string; message: string }[] };
  slug: string;
  locale: string | null;
  backHref: string;
}

export function DocumentEditor({
  collection,
  file,
  initialMeta,
  initialBody,
  initialValidation,
  slug,
  locale,
  backHref,
}: DocumentEditorProps) {
  const [meta, setMeta] = useState<Record<string, unknown>>(initialMeta);
  const [body, setBody] = useState(initialBody);
  const [validation, setValidation] = useState(initialValidation);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [metadataOpen, setMetadataOpen] = useState(true);

  const updateMeta = useCallback((key: string, value: unknown) => {
    setMeta((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(
        `/api/documents/content?collection=${encodeURIComponent(collection)}&file=${encodeURIComponent(file)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meta, body }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.validation?.errors?.length) {
          setValidation({ valid: false, errors: data.validation.errors });
        }
        setSaveError(data.error || res.statusText);
        return;
      }
      setValidation({ valid: true, errors: [] });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [collection, file, meta, body]);

  const metaKeys = Object.keys(meta);

  return (
    <div className="mx-auto max-w-4xl p-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{slug}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{file}</p>
          {locale && <span className="text-xs text-muted-foreground">Locale: {locale}</span>}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving} size="default" className="rounded-lg">
            {saving ? "Saving…" : "Save"}
          </Button>
          <a href={backHref} className="text-sm font-medium text-primary hover:underline">
            Back to collection
          </a>
        </div>
      </div>

      {saveError && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="py-3 text-sm text-destructive">{saveError}</CardContent>
        </Card>
      )}

      {!validation.valid && validation.errors.length > 0 && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertIcon className="h-4 w-4" />
              Schema validation errors
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-inside list-disc space-y-1">
              {validation.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.field}</span>: {e.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Collapsible open={metadataOpen} onOpenChange={setMetadataOpen} className="mb-6">
        <CollapsibleTrigger
          type="button"
          className="flex w-full items-center gap-2 rounded-lg py-2.5 px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
        >
          {metadataOpen ? (
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          Metadata
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2 border-border/80 shadow-sm">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {metaKeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No metadata fields.</p>
                ) : (
                  metaKeys.map((key) => (
                    <div
                      key={key}
                      className="grid grid-cols-[minmax(120px,auto)_1fr] items-center gap-2"
                    >
                      <label
                        className="text-sm font-medium text-foreground"
                        htmlFor={`meta-${key}`}
                      >
                        {key}
                      </label>
                      <Input
                        id={`meta-${key}`}
                        value={metaValueToString(meta[key])}
                        onChange={(e) => {
                          const v = parseMetaValue(e.target.value);
                          updateMeta(key, v);
                        }}
                        className="font-mono text-sm"
                      />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Body</h2>
        <Card className="border-border/80 shadow-sm">
          <CardContent className="pt-6">
            <BodyEditor
              key={`${collection}-${file}`}
              markdown={body}
              onChange={setBody}
              className="min-h-[320px] [&_.mdxeditor]:min-h-[280px]"
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
