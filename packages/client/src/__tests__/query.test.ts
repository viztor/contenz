import { describe, expect, it } from "vitest";

import { query } from "../query.js";

interface TestPost {
  slug: string;
  title: string;
  draft: boolean;
  score: number;
  tags: string[];
}

const mockData: Record<string, TestPost> = {
  post1: {
    slug: "post1",
    title: "A",
    draft: false,
    score: 10,
    tags: ["js", "ts"],
  },
  post2: { slug: "post2", title: "B", draft: true, score: 20, tags: ["ts"] },
  post3: {
    slug: "post3",
    title: "C",
    draft: false,
    score: 5,
    tags: ["js", "react"],
  },
  post4: { slug: "post4", title: "D", draft: false, score: 15, tags: ["rust"] },
};

describe("QueryBuilder", () => {
  it("filters with ==", () => {
    const result = query(mockData).where("draft", "==", false).all();
    expect(result.length).toBe(3);
    expect(result.map((r) => r.slug)).toEqual(["post1", "post3", "post4"]);
  });

  it("filters with >", () => {
    const result = query(mockData).where("score", ">", 10).all();
    expect(result.length).toBe(2);
    expect(result.map((r) => r.slug)).toEqual(["post2", "post4"]);
  });

  it("filters with in", () => {
    const result = query(mockData)
      .where("slug", "in", ["post1", "post3"])
      .all();
    expect(result.length).toBe(2);
    expect(result.map((r) => r.slug)).toEqual(["post1", "post3"]);
  });

  it("filters with contains", () => {
    const result = query(mockData).where("tags", "contains", "ts").all();
    expect(result.length).toBe(2);
    expect(result.map((r) => r.slug)).toEqual(["post1", "post2"]);
  });

  it("chains multiple where clauses", () => {
    const result = query(mockData)
      .where("draft", "==", false)
      .where("score", ">=", 10)
      .all();
    expect(result.length).toBe(2);
    expect(result.map((r) => r.slug)).toEqual(["post1", "post4"]);
  });

  it("orders results asc", () => {
    const result = query(mockData).orderBy("score", "asc").all();
    expect(result.map((r) => r.score)).toEqual([5, 10, 15, 20]);
  });

  it("orders results desc", () => {
    const result = query(mockData).orderBy("score", "desc").all();
    expect(result.map((r) => r.score)).toEqual([20, 15, 10, 5]);
  });

  it("paginates results", () => {
    const q = query(mockData).orderBy("score", "asc");
    const page1 = q.paginate({ page: 1, limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.items.map((r) => r.score)).toEqual([5, 10]);
    expect(page1.total).toBe(4);
    expect(page1.totalPages).toBe(2);

    const page2 = q.paginate({ page: 2, limit: 2 });
    expect(page2.items.length).toBe(2);
    expect(page2.items.map((r) => r.score)).toEqual([15, 20]);
  });

  it("limits results", () => {
    const result = query(mockData).orderBy("score", "desc").limit(2).all();
    expect(result.length).toBe(2);
    expect(result.map((r) => r.score)).toEqual([20, 15]);
  });

  it("offsets results", () => {
    const result = query(mockData).orderBy("score", "desc").offset(1).all();
    expect(result.length).toBe(3);
    expect(result.map((r) => r.score)).toEqual([15, 10, 5]);
  });

  it("returns first result", () => {
    const result = query(mockData).orderBy("score", "desc").first();
    expect(result?.slug).toBe("post2");
  });
});
