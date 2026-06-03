sed -i 's/T extends Record<string, any>/T extends Record<string, unknown>/g' packages/client/src/query.ts
sed -i 's/value: any): this/value: unknown): this/g' packages/client/src/query.ts
