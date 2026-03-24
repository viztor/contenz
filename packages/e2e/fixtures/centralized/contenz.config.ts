import { z } from "zod";
import type { ContenzConfig } from "@contenz/core";

export const config: ContenzConfig = {
  collections: {
    notes: {
      path: "content/notes",
      schema: z.object({
        title: z.string(),
        priority: z.enum(["low", "medium", "high"]),
      }),
    },
  },
};
