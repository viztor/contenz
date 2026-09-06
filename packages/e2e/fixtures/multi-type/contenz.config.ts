import type { ContenzConfig } from "@contenz/core";
import { mdxAdapter } from "@contenz/adapter-mdx";

export const config: ContenzConfig = {
  i18n: true,
  adapters: [mdxAdapter],
  collections: {
    terms: {
      path: "content/terms",
      config: {
        types: [
          { name: "topic", pattern: /^topic-/ },
          { name: "term", pattern: /.*/ },
        ],
      },
    },
  },
};
