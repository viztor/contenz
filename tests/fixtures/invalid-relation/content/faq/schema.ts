import { z } from "zod";
import { defineCollection } from "content-tools";

const schema = z.object({
  question: z.string(),
  category: z.enum(["products", "ordering"]),
  relatedFaqs: z.array(z.string()).optional(),
});

export const { meta, metaSchema, relations } = defineCollection({
  schema,
  relations: { relatedFaqs: "faq" },
});

export type FAQMeta = z.infer<typeof meta>;
