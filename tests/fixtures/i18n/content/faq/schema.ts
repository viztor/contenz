import { z } from "zod";
import { defineCollection } from "content-tools";

const schema = z.object({
  question: z.string(),
  category: z.enum(["products", "ordering"]),
});

export const { meta, metaSchema, relations } = defineCollection({
  schema,
});

export type FAQMeta = z.infer<typeof meta>;
