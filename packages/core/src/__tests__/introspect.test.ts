import { describe, expect, it } from "vitest";
import { z } from "zod";
import { introspectSchema } from "../introspect.js";

describe("Schema Introspection", () => {
  describe("Primitives", () => {
    it("extracts basic types correctly", () => {
      const schema = z.object({
        str: z.string(),
        num: z.number(),
        bool: z.boolean(),
        date: z.date(),
        any: z.any(),
      });

      const result = introspectSchema(schema);

      expect(result.fields.str).toMatchObject({ type: "string", required: true });
      expect(result.fields.num).toMatchObject({ type: "number", required: true });
      expect(result.fields.bool).toMatchObject({ type: "boolean", required: true });
      expect(result.fields.date).toMatchObject({ type: "date", required: true });
      expect(result.fields.any).toMatchObject({ type: "any", required: true });
    });
  });

  describe("Constraints", () => {
    it("handles optional, nullable, and defaults", () => {
      const schema = z.object({
        opt: z.string().optional(),
        null: z.string().nullable(),
        def: z.string().default("test"),
      });

      const result = introspectSchema(schema);

      expect(result.fields.opt).toMatchObject({ type: "string", required: false });
      expect(result.fields.null).toMatchObject({ type: "string", required: false });
      expect(result.fields.def).toMatchObject({ type: "string", required: false, default: "test" });
    });

    it("handles descriptions", () => {
      const schema = z.object({
        desc: z.string().describe("Test description"),
        defDesc: z.string().default("test").describe("Test description on default"),
        optDesc: z.string().describe("Test description on opt").optional(),
      });

      const result = introspectSchema(schema);

      expect(result.fields.desc.description).toBe("Test description");
      expect(result.fields.defDesc.description).toBe("Test description on default");
      expect(result.fields.optDesc.description).toBe("Test description on opt");
    });
  });

  describe("Complex Types", () => {
    it("handles arrays", () => {
      const schema = z.object({
        arr: z.array(z.string()),
      });

      const result = introspectSchema(schema);

      expect(result.fields.arr).toMatchObject({
        type: "array",
        required: true,
        itemType: { type: "string", required: true },
      });
    });

    it("handles nested objects", () => {
      const schema = z.object({
        nested: z.object({
          inner: z.number(),
        }),
      });

      const result = introspectSchema(schema);

      expect(result.fields.nested).toMatchObject({
        type: "object",
        required: true,
        shape: {
          inner: { type: "number", required: true },
        },
      });
    });

    it("handles enums and literal unions", () => {
      enum NativeEnum {
        A = "a",
        B = "b",
      }

      const schema = z.object({
        zEnum: z.enum(["one", "two"]),
        native: z.nativeEnum(NativeEnum),
        literalUnion: z.union([z.literal("x"), z.literal("y")]),
        literal: z.literal("fixed"),
      });

      const result = introspectSchema(schema);

      expect(result.fields.zEnum).toMatchObject({ type: "enum", options: ["one", "two"] });
      expect(result.fields.native).toMatchObject({ type: "enum", options: ["a", "b"] });
      expect(result.fields.literalUnion).toMatchObject({ type: "enum", options: ["x", "y"] });
      expect(result.fields.literal).toMatchObject({ type: "enum", options: ["fixed"] });
    });
  });

  describe("Effects", () => {
    it("unwraps transforms, refines, and superRefines", () => {
      const schema = z.object({
        transformed: z.string().transform((v) => v.toUpperCase()),
        refined: z.number().refine((n) => n > 0),
        superRefined: z.boolean().superRefine((v, ctx) => {
          if (!v) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be true" });
        }),
        transformedDesc: z
          .string()
          .describe("base desc")
          .transform((v) => v),
      });

      const result = introspectSchema(schema);

      expect(result.fields.transformed).toMatchObject({ type: "string", required: true });
      expect(result.fields.refined).toMatchObject({ type: "number", required: true });
      expect(result.fields.superRefined).toMatchObject({ type: "boolean", required: true });
      expect(result.fields.transformedDesc.description).toBe("base desc");
    });

    it("unwraps ZodEffects at the object level", () => {
      const schema = z
        .object({
          a: z.string(),
        })
        .refine((obj) => obj.a === "test");

      const result = introspectSchema(schema);

      expect(result.fields.a).toMatchObject({ type: "string" });
    });
  });

  describe("External Descriptions Map", () => {
    it("applies descriptions passed separately", () => {
      const schema = z.object({
        title: z.string(),
      });

      const result = introspectSchema(schema, {
        title: "The title of the post",
      });

      expect(result.fields.title.description).toBe("The title of the post");
    });

    it("overrides inline descriptions with external ones", () => {
      const schema = z.object({
        title: z.string().describe("Base desc"),
      });

      const result = introspectSchema(schema, {
        title: "Override desc",
      });

      expect(result.fields.title.description).toBe("Override desc");
    });
  });
});
