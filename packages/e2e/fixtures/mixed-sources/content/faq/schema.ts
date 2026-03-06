import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  question: z.string(),
});

export const { meta, metaSchema, relations } = defineCollection({
  schema,
});

export type FaqMeta = z.infer<typeof meta>;
