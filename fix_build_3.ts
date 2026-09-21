import fs from 'node:fs/promises';

async function main() {
    const p = 'packages/core/src/run-build.ts';
    let code = await fs.readFile(p, 'utf-8');
    code = code.replace(
        '  for (const file of contentFiles) {',
        '  await Promise.all(contentFiles.map(async (file) => {'
    );
    code = code.replace(
        '        for (const [key, computeFn] of Object.entries(schemaModule.computed)) {',
        '        await Promise.all(Object.entries(schemaModule.computed).map(async ([key, computeFn]) => {'
    );
    code = code.replace(
        '          } catch (err) {\n            parseErrors++;\n            diagnostics.push({\n              code: "COMPUTED_FIELD_FAILED",\n              severity: "error",\n              category: "content",\n              message: `Failed to compute field "${key}": ${err instanceof Error ? err.message : String(err)}`,\n              source: "build",\n              collection: collectionName,\n              file,\n            });\n          }\n        }',
        '          } catch (err) {\n            parseErrors++;\n            diagnostics.push({\n              code: "COMPUTED_FIELD_FAILED",\n              severity: "error",\n              category: "content",\n              message: `Failed to compute field "${key}": ${err instanceof Error ? err.message : String(err)}`,\n              source: "build",\n              collection: collectionName,\n              file,\n            });\n          }\n        }));'
    );
    code = code.replace(
        '      continue;\n    }\n    try {',
        '      return;\n    }\n    try {'
    );
    code = code.replace(
        '        continue;\n      }\n      if (!typeGroups.has(contentType))',
        '        return;\n      }\n      if (!typeGroups.has(contentType))'
    );
    code = code.replace(
        '        continue;\n      }\n      if (effectiveConfig.i18n && parsed.locale) {',
        '        return;\n      }\n      if (effectiveConfig.i18n && parsed.locale) {'
    );
    code = code.replace(
        '        file,\n      });\n    }\n  }',
        '        file,\n      });\n    }\n  }));'
    );
    await fs.writeFile(p, code, 'utf-8');
}
main();
