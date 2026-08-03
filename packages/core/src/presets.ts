import { z } from "zod";

export const presets = {
  /**
   * Standard blog post schema preset
   * Includes title, date, excerpt, tags, and draft status.
   */
  blogPost() {
    return z.object({
      title: z.string().min(1, "Title is required").describe("The post title"),
      date: z.date().describe("Publish date"),
      excerpt: z.string().optional().describe("Short summary of the post"),
      tags: z.array(z.string()).default([]).describe("Categorization tags"),
      draft: z
        .boolean()
        .default(false)
        .describe("If true, this post should not be published"),
    });
  },

  /**
   * Standard documentation page schema preset
   * Includes title, description, and order for sidebar sorting.
   */
  docsPage() {
    return z.object({
      title: z.string().min(1, "Title is required").describe("The page title"),
      description: z
        .string()
        .optional()
        .describe("Description for SEO and previews"),
      order: z
        .number()
        .int()
        .optional()
        .describe("Order in the sidebar navigation"),
    });
  },

  /**
   * Minimal page schema
   * Includes only a title.
   */
  page() {
    return z.object({
      title: z.string().min(1, "Title is required").describe("The page title"),
    });
  },
};
