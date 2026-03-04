import { defineMultiTypeCollection } from "content-tools";
import { z } from "zod";

const termSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

const topicSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});

export const { termMeta, topicMeta, meta, relations } = defineMultiTypeCollection({
  schemas: { term: termSchema, topic: topicSchema },
});

export type TermMeta = z.infer<typeof termMeta>;
export type TopicMeta = z.infer<typeof topicMeta>;
