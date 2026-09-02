import { getSchemaForType } from "./config.js";
import { type IntrospectedField, introspectSchema } from "./introspect.js";
import { createWorkspace } from "./workspace.js";

export interface RunSkillResult {
  success: boolean;
  data?: string;
  error?: string;
}

function formatField(
  name: string,
  field: IntrospectedField,
  indent = 0
): string {
  const prefix = `${"  ".repeat(indent)}- `;
  const req = field.required ? "**(required)**" : "*(optional)*";
  let str = `${prefix}\`${name}\`: \`${field.type}\` ${req}`;
  if (field.description) {
    str += ` — ${field.description}`;
  }
  if (field.default !== undefined) {
    str += ` (default: \`${JSON.stringify(field.default)}\`)`;
  }
  str += "\n";

  if (field.type === "enum" && field.options) {
    str += `${"  ".repeat(indent + 1)}- Options: ${field.options.map((o) => `\`${o}\``).join(", ")}\n`;
  } else if (field.type === "array" && field.itemType) {
    str += formatField("item", field.itemType, indent + 1);
  } else if (field.type === "object" && field.shape) {
    for (const [k, v] of Object.entries(field.shape)) {
      str += formatField(k, v, indent + 1);
    }
  }
  return str;
}

export async function runSkill(cwd: string): Promise<RunSkillResult> {
  try {
    const ws = await createWorkspace({ cwd });

    let md = `---
name: project-content-model
description: Instructions for managing content in this project using the Contenz CLI. Use this skill whenever interacting with content collections, creating/updating items, or doing translation workflows.
---

# Project Content Guide

This project manages its content using the **Contenz CLI** (\`npx contenz\`).
As an AI agent, you must use the Contenz CLI commands (e.g., \`contenz create\`, \`contenz update\`, \`contenz view\`) rather than manually editing content metadata, to ensure schemas and relations are strictly respected.

For full details on the CLI, see \`contenz --help\` or refer to the standard Contenz skill if available.

## Available Collections

Below is the introspected content model for this workspace.

`;

    if (ws.collections.length === 0) {
      md += `*No collections found in this workspace.*\n`;
    }

    for (const collection of ws.collections) {
      md += `### Collection: \`${collection.name}\`\n\n`;
      md += `- **Directory**: \`${collection.collectionPath}\`\n`;

      if (collection.config.i18n) {
        md += `- **i18n**: Enabled (Default Locale: \`${collection.config.resolvedI18n.defaultLocale}\`)\n`;
      } else {
        md += `- **i18n**: Disabled\n`;
      }

      const schemaModule = collection.schema;
      if (!schemaModule) {
        md += `- **Schema**: No \`schema.ts\` defined.\n\n`;
        continue;
      }

      md += `\n#### Fields\n\n`;

      const types = collection.config.types ?? [
        { name: "default", pattern: /.*/ },
      ];

      for (const type of types) {
        if (type.name !== "default") {
          md += `**Content Type: \`${type.name}\`**\n\n`;
        }

        const zSchema = getSchemaForType(schemaModule, type.name);
        if (!zSchema) {
          md += `*No schema exported for this type.*\n\n`;
          continue;
        }

        const introspected = introspectSchema(zSchema);
        if (Object.keys(introspected.fields).length === 0) {
          md += `*Schema has no introspectable fields.*\n\n`;
        } else {
          for (const [fieldName, field] of Object.entries(
            introspected.fields
          )) {
            md += formatField(fieldName, field);
          }
          md += `\n`;
        }
      }
    }

    return { success: true, data: md };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
