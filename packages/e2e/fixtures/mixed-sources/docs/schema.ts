import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
});

export const { meta, metaSchema, relations } = defineCollection({
  schema,
});

export type DocsMeta = z.infer<typeof meta>;
