import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1),
  author: z.string(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published", "archived"]),
  relatedTerms: z.array(z.string()).optional(),
});

export const { meta, relations } = defineCollection({
  schema,
  relations: {
    relatedTerms: "glossary",
  },
});

export type BlogMeta = z.infer<typeof meta>;
