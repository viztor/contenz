import type { ContenzConfig } from "@contenz/core";
import { mdxAdapter } from "@contenz/adapter-mdx";

export const config: ContenzConfig = {
  i18n: true,
  adapters: [mdxAdapter],
  sources: ["content/*"],
};
