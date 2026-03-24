import pc from "picocolors";

export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticCategory =
  | "config"
  | "discovery"
  | "schema"
  | "content"
  | "validation"
  | "relation"
  | "build"
  | "i18n";

export type DiagnosticFormat = "pretty" | "json" | "github";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  message: string;
  source: string;
  collection?: string;
  file?: string;
  field?: string;
}

export interface DiagnosticSummary {
  errors: number;
  warnings: number;
  info: number;
}

interface DiagnosticReportInput {
  diagnostics: Diagnostic[];
  format: DiagnosticFormat;
  title: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  footer?: string;
}

function severityWeight(severity: DiagnosticSeverity): number {
  switch (severity) {
    case "error":
      return 0;
    case "warning":
      return 1;
    case "info":
      return 2;
  }
}

function formatLocation(diagnostic: Diagnostic): string {
  const parts = [diagnostic.collection, diagnostic.file].filter(Boolean);
  return parts.length > 0 ? parts.join("/") : "";
}

function escapeGithubValue(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return (
    severityWeight(left.severity) - severityWeight(right.severity) ||
    left.collection?.localeCompare(right.collection ?? "") ||
    left.file?.localeCompare(right.file ?? "") ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}

function summarizeDiagnostics(diagnostics: Diagnostic[]): DiagnosticSummary {
  const summary: DiagnosticSummary = { errors: 0, warnings: 0, info: 0 };
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity === "error") summary.errors += 1;
    if (diagnostic.severity === "warning") summary.warnings += 1;
    if (diagnostic.severity === "info") summary.info += 1;
  }
  return summary;
}

function formatPrettyReport(input: DiagnosticReportInput): string {
  const diagnostics = [...input.diagnostics].sort(compareDiagnostics);
  const summary = summarizeDiagnostics(diagnostics);
  const lines = [pc.bold(`\n${input.title}`)];
  lines.push(
    `${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.info} info message(s)`
  );

  if (diagnostics.length === 0) {
    lines.push("");
    lines.push(pc.green(input.success ? "No diagnostics." : "No diagnostics were emitted."));
  } else {
    lines.push("");

    for (const diagnostic of diagnostics) {
      const location = formatLocation(diagnostic);
      const prefix =
        diagnostic.severity === "error"
          ? pc.red("error")
          : diagnostic.severity === "warning"
            ? pc.yellow("warning")
            : pc.blue("info");
      const code = pc.dim(diagnostic.code);
      const category = pc.dim(`[${diagnostic.category}]`);
      const locationLabel = location ? ` ${pc.dim(location)}` : "";
      const fieldLabel = diagnostic.field ? ` ${pc.dim(`(${diagnostic.field})`)}` : "";
      lines.push(`${prefix} ${code} ${category}${locationLabel}${fieldLabel}`);
      lines.push(`  ${diagnostic.message}`);
    }
  }

  if (input.footer) {
    lines.push("");
    lines.push(pc.dim(input.footer));
  }

  return lines.join("\n");
}

function formatJsonReport(input: DiagnosticReportInput): string {
  return JSON.stringify(
    {
      success: input.success,
      data: {
        title: input.title,
        summary: summarizeDiagnostics(input.diagnostics),
        ...input.metadata,
      },
      diagnostics: [...input.diagnostics].sort(compareDiagnostics),
    },
    null,
    2
  );
}

function formatGithubReport(input: DiagnosticReportInput): string {
  const lines: string[] = [];
  for (const diagnostic of [...input.diagnostics].sort(compareDiagnostics)) {
    const command =
      diagnostic.severity === "error"
        ? "error"
        : diagnostic.severity === "warning"
          ? "warning"
          : "notice";
    const metadata: string[] = [];
    if (diagnostic.file) metadata.push(`file=${escapeGithubValue(diagnostic.file)}`);
    if (diagnostic.field) {
      metadata.push(`title=${escapeGithubValue(`${diagnostic.code} (${diagnostic.field})`)}`);
    } else metadata.push(`title=${escapeGithubValue(diagnostic.code)}`);

    const location = formatLocation(diagnostic);
    const message = location ? `${location}: ${diagnostic.message}` : diagnostic.message;
    lines.push(`::${command} ${metadata.join(",")}::${escapeGithubValue(message)}`);
  }

  if (lines.length === 0) {
    lines.push(
      `::notice title=${escapeGithubValue(input.title)}::${escapeGithubValue(
        input.success ? "No diagnostics." : "No diagnostics were emitted."
      )}`
    );
  }

  return lines.join("\n");
}

export function formatDiagnosticsReport(input: DiagnosticReportInput): string {
  switch (input.format) {
    case "json":
      return formatJsonReport(input);
    case "github":
      return formatGithubReport(input);
    default:
      return formatPrettyReport(input);
  }
}
