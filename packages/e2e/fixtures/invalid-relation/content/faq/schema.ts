import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  question: z.string(),
  category: z.enum(["products", "ordering"]),
  relatedFaqs: z.array(z.string()).optional(),
});

export const { meta, relations } = defineCollection({
  schema,
  relations: { relatedFaqs: "faq" },
});

export type FAQMeta = z.infer<typeof meta>;
