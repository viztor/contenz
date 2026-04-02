import { defineCollection } from "@contenz/core";
import { z } from "zod";

const schema = z.object({
  term: z.string(),
  definition: z.string(),
  seeAlso: z.array(z.string()).optional(),
});

export const { meta, relations } = defineCollection({
  schema,
  relations: {
    seeAlso: "glossary",
  },
});

export type GlossaryMeta = z.infer<typeof meta>;
