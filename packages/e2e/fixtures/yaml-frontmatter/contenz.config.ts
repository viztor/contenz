import { mdxAdapter } from "@contenz/adapter-mdx";
import type { ContenzConfig } from "@contenz/core";
import { z } from "zod";

export const config: ContenzConfig = {
  outputDir: "generated/content",
  adapters: [mdxAdapter],
  collections: {
    guides: {
      path: "content/guides",
      schema: z.object({
        title: z.string(),
        featured: z.boolean().default(false),
        keywords: z.array(z.string()).default([]),
        relatedCareers: z.array(z.string()).default([]),
        salaryTeasers: z
          .array(
            z.object({
              range: z.string(),
              currency: z.string(),
              period: z.string(),
              label: z.object({ en: z.string(), zh: z.string() }).optional(),
            })
          )
          .optional(),
      }),
    },
  },
};
