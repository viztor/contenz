import type { CollectionConfig } from "content-tools";

export const config: CollectionConfig = {
  i18n: true,
  types: [
    { name: "topic", pattern: /^topic-/ },
    { name: "term", pattern: /.*/ },
  ],
};
