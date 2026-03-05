import type { CollectionConfig } from "@contenz/core";

export const config: CollectionConfig = {
  i18n: true,
  types: [
    { name: "topic", pattern: /^topic-/ },
    { name: "term", pattern: /.*/ },
  ],
};
