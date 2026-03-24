import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  question: z.string(),
  category: z.enum(["products", "ordering"]),
});

export const { meta, relations } = defineCollection({
  schema,
});

export type FAQMeta = z.infer<typeof meta>;
