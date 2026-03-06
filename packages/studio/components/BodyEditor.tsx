"use client";

import dynamic from "next/dynamic";

const InitializedMDXEditor = dynamic(() => import("@/components/InitializedMDXEditor"), {
  ssr: false,
});

export interface BodyEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  className?: string;
}

export function BodyEditor({ markdown, onChange, className }: BodyEditorProps) {
  return (
    <div className={`contenz-mdx-editor ${className ?? ""}`.trim()}>
      <InitializedMDXEditor markdown={markdown} onChange={(md) => onChange(md)} editorRef={null} />
    </div>
  );
}
