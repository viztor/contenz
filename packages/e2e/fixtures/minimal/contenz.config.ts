import type { ContenzConfig } from "@contenz/core";
import { mdxAdapter } from "@contenz/adapter-mdx";

export const config: ContenzConfig = {
  i18n: false,
  adapters: [mdxAdapter],
};
