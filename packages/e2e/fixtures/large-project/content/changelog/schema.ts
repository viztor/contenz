import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  version: z.string(),
  date: z.string(),
  breaking: z.boolean().optional(),
});

export const { meta, relations } = defineCollection({
  schema,
});

export type ChangelogMeta = z.infer<typeof meta>;
