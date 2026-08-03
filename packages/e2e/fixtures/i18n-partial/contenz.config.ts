import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  strict: false,
  i18n: {
    enabled: true,
    defaultLocale: "en",
    locales: ["en", "zh", "ja"],
    coverageThreshold: 0.8,
  },
};
