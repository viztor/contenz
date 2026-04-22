/**
 * Unit tests for the diagnostic formatting system.
 */
import { describe, expect, it } from "vitest";
import {
  type Diagnostic,
  formatDiagnosticsReport,
  schemaExportMissing,
  schemaLoadFailed,
} from "./diagnostics.js";

function makeDiag(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    code: "TEST_ERROR",
    severity: "error",
    category: "validation",
    message: "Something went wrong",
    source: "test",
    ...overrides,
  };
}

describe("formatDiagnosticsReport", () => {
  describe("pretty format", () => {
    it("renders empty diagnostics with success message", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [],
        format: "pretty",
        title: "Test Report",
        success: true,
      });
      expect(report).toContain("Test Report");
      expect(report).toContain("0 error(s)");
      expect(report).toContain("No diagnostics.");
    });

    it("renders errors and warnings with codes and categories", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [
          makeDiag({ code: "E001", severity: "error", message: "Bad field" }),
          makeDiag({ code: "W001", severity: "warning", message: "Deprecated" }),
        ],
        format: "pretty",
        title: "Lint",
        success: false,
      });
      expect(report).toContain("1 error(s)");
      expect(report).toContain("1 warning(s)");
      expect(report).toContain("Bad field");
      expect(report).toContain("Deprecated");
    });

    it("includes collection and field in output", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [makeDiag({ collection: "faq", file: "moq.en.mdx", field: "title" })],
        format: "pretty",
        title: "Lint",
        success: false,
      });
      expect(report).toContain("faq");
      expect(report).toContain("moq.en.mdx");
      expect(report).toContain("title");
    });

    it("includes footer when provided", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [],
        format: "pretty",
        title: "Build",
        success: true,
        footer: "Generated 3 files",
      });
      expect(report).toContain("Generated 3 files");
    });
  });

  describe("json format", () => {
    it("renders valid JSON with success and diagnostics", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [makeDiag()],
        format: "json",
        title: "Build",
        success: false,
        metadata: { generatedFiles: 0 },
      });
      const parsed = JSON.parse(report);
      expect(parsed.success).toBe(false);
      expect(parsed.data.title).toBe("Build");
      expect(parsed.data.generatedFiles).toBe(0);
      expect(parsed.data.summary.errors).toBe(1);
      expect(parsed.diagnostics).toHaveLength(1);
      expect(parsed.diagnostics[0].code).toBe("TEST_ERROR");
    });

    it("renders empty diagnostics array when none", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [],
        format: "json",
        title: "Lint",
        success: true,
      });
      const parsed = JSON.parse(report);
      expect(parsed.success).toBe(true);
      expect(parsed.diagnostics).toEqual([]);
    });
  });

  describe("github format", () => {
    it("renders GitHub Actions annotation format", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [
          makeDiag({
            severity: "error",
            code: "SCHEMA_MISSING",
            file: "content/faq/moq.mdx",
            message: "No schema",
          }),
        ],
        format: "github",
        title: "Lint",
        success: false,
      });
      expect(report).toMatch(/^::error /);
      expect(report).toContain("title=SCHEMA_MISSING");
      expect(report).toContain("file=content/faq/moq.mdx");
    });

    it("renders warning annotations for warning severity", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [makeDiag({ severity: "warning", code: "W1" })],
        format: "github",
        title: "Lint",
        success: true,
      });
      expect(report).toMatch(/^::warning /);
    });

    it("renders notice for empty diagnostics", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [],
        format: "github",
        title: "Lint OK",
        success: true,
      });
      expect(report).toMatch(/^::notice /);
      expect(report).toContain("Lint OK");
    });
  });

  describe("sorting", () => {
    it("sorts errors before warnings before info", () => {
      const report = formatDiagnosticsReport({
        diagnostics: [
          makeDiag({ severity: "info", code: "I1", message: "Info msg" }),
          makeDiag({ severity: "error", code: "E1", message: "Error msg" }),
          makeDiag({ severity: "warning", code: "W1", message: "Warn msg" }),
        ],
        format: "json",
        title: "Test",
        success: false,
      });
      const parsed = JSON.parse(report);
      expect(parsed.diagnostics[0].severity).toBe("error");
      expect(parsed.diagnostics[1].severity).toBe("warning");
      expect(parsed.diagnostics[2].severity).toBe("info");
    });
  });
});

describe("diagnostic factories", () => {
  it("schemaLoadFailed creates correct diagnostic", () => {
    const d = schemaLoadFailed("build", "faq");
    expect(d.code).toBe("SCHEMA_LOAD_FAILED");
    expect(d.severity).toBe("error");
    expect(d.category).toBe("schema");
    expect(d.collection).toBe("faq");
    expect(d.source).toBe("build");
  });

  it("schemaExportMissing creates correct diagnostic", () => {
    const d = schemaExportMissing("lint", "glossary");
    expect(d.code).toBe("SCHEMA_EXPORT_MISSING");
    expect(d.severity).toBe("error");
    expect(d.collection).toBe("glossary");
  });
});
