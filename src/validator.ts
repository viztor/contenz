import pc from "picocolors";
import type { ZodSchema } from "zod";
import type { Relations } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  file: string;
  field: string;
  message: string;
  /** For relation errors: the missing slug */
  missingSlug?: string;
  /** For relation errors: the target collection */
  targetCollection?: string;
}

export interface ValidationWarning {
  file: string;
  message: string;
}

export interface ValidationInfo {
  file: string;
  message: string;
}

/**
 * Validate metadata against a Zod schema.
 */
export function validateMeta(
  meta: Record<string, unknown>,
  schema: ZodSchema,
  filePath: string
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const parseResult = schema.safeParse(meta);

  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        file: filePath,
        field: issue.path.join(".") || "root",
        message: issue.message,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface RelationValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
}

/**
 * Validate relations for a single content item.
 *
 * @param meta - The metadata object
 * @param filePath - Path to the content file
 * @param relations - Relations mapping (field → target collection)
 * @param collectionSlugs - Map of collection name → set of valid slugs
 */
export function validateRelations(
  meta: Record<string, unknown>,
  filePath: string,
  relations: Relations,
  collectionSlugs: Map<string, Set<string>>,
  currentSlug: string
): RelationValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const info: ValidationInfo[] = [];

  for (const [field, targetCollection] of Object.entries(relations)) {
    const value = meta[field];
    if (!value || !Array.isArray(value)) continue;

    const targetSlugs = collectionSlugs.get(targetCollection);
    if (!targetSlugs) {
      errors.push({
        file: filePath,
        field,
        message: `Target collection "${targetCollection}" not found`,
      });
      continue;
    }

    for (const slug of value) {
      if (typeof slug !== "string") continue;

      // Self-reference check
      if (slug === currentSlug) {
        warnings.push({
          file: filePath,
          message: `Self-reference in ${field}: "${slug}"`,
        });
        continue;
      }

      // Existence check
      if (!targetSlugs.has(slug)) {
        errors.push({
          file: filePath,
          field,
          message: `Slug "${slug}" not found in "${targetCollection}"`,
          missingSlug: slug,
          targetCollection,
        });
      }
    }
  }

  return { errors, warnings, info };
}

/**
 * Detect circular references across all items in a collection.
 */
export function detectCircularReferences(
  items: Map<string, { slug: string; relatedSlugs: string[] }>
): { circularRefs: string[]; selfRefs: string[] } {
  const circularRefs: string[] = [];
  const selfRefs: string[] = [];
  const allSlugs = new Set(items.keys());

  // Detect self-references
  for (const [slug, item] of items) {
    if (item.relatedSlugs.includes(slug)) {
      selfRefs.push(slug);
    }
  }

  // Detect circular references
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function detectCycle(slug: string, path: string[]): void {
    if (inStack.has(slug)) {
      const cycleStart = path.indexOf(slug);
      const cycle = path.slice(cycleStart).join(" ↔ ");
      if (!circularRefs.includes(cycle)) {
        circularRefs.push(cycle);
      }
      return;
    }

    if (visited.has(slug)) return;

    visited.add(slug);
    inStack.add(slug);

    const item = items.get(slug);
    if (item) {
      for (const relatedSlug of item.relatedSlugs) {
        if (allSlugs.has(relatedSlug) && relatedSlug !== slug) {
          detectCycle(relatedSlug, [...path, slug]);
        }
      }
    }

    inStack.delete(slug);
  }

  for (const slug of items.keys()) {
    detectCycle(slug, []);
  }

  return { circularRefs, selfRefs };
}

/**
 * Auto-detect relations from field names matching `related{Collection}` pattern.
 */
export function autoDetectRelations(
  meta: Record<string, unknown>,
  availableCollections: string[]
): Relations {
  const relations: Relations = {};

  for (const fieldName of Object.keys(meta)) {
    const match = fieldName.match(/^related([A-Z][a-zA-Z]*)$/);
    if (match) {
      const targetCollection = match[1].toLowerCase();
      if (availableCollections.includes(targetCollection)) {
        relations[fieldName] = targetCollection;
      }
    }
  }

  return relations;
}

/**
 * Format validation results for console output.
 */
export function formatValidationResults(results: ValidationResult[]): string {
  const allErrors = results.flatMap((r) => r.errors);
  const allWarnings = results.flatMap((r) => r.warnings);

  let output = "";

  if (allErrors.length > 0) {
    output += pc.red("\n✗ Validation Errors:\n");
    for (const error of allErrors) {
      output += `  ${pc.dim(error.file)}: ${error.field} - ${error.message}\n`;
    }
  }

  if (allWarnings.length > 0) {
    output += pc.yellow("\n⚠ Warnings:\n");
    for (const warning of allWarnings) {
      output += `  ${pc.dim(warning.file)}: ${warning.message}\n`;
    }
  }

  return output;
}

// Legacy export for backward compatibility
export interface RelationshipValidationResult {
  errors: ValidationError[];
  circularRefs: string[];
  selfRefs: string[];
}

export function validateRelationships(
  items: Map<string, { slug: string; relatedSlugs: string[] }>,
  collectionName: string
): RelationshipValidationResult {
  const { circularRefs, selfRefs } = detectCircularReferences(items);
  const errors: ValidationError[] = [];
  const allSlugs = new Set(items.keys());

  for (const [slug, item] of items) {
    for (const relatedSlug of item.relatedSlugs) {
      if (relatedSlug !== slug && !allSlugs.has(relatedSlug)) {
        errors.push({
          file: `${collectionName}/${slug}`,
          field: "relatedTerms/relatedFaqs",
          message: `References non-existent slug "${relatedSlug}"`,
        });
      }
    }
  }

  return { errors, circularRefs, selfRefs };
}
