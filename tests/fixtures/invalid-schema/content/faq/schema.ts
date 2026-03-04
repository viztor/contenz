import { defineCollection } from "content-tools";
import { z } from "zod";

const schema = z.object({
  question: z.string().min(10),
  category: z.enum(["products", "ordering"]),
});

export const { meta, metaSchema, relations } = defineCollection({
  schema,
});

export type FAQMeta = z.infer<typeof meta>;
