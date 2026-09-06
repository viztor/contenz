import { z } from "zod";
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  i18n: {
    enabled: true,
    defaultLocale: "en",
    locales: ["en", "zh"],
  },
  collections: {
    faq: {
      path: "content/faq",
      schema: z.object({
        question: z.string(),
        category: z.enum(["products", "ordering"]),
      }),
    },
  },
  singles: {
    site: {
      path: "data/site.en.json",
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
      }),
    },
    motto: {
      path: "data/motto.en.json",
    },
  },
};
