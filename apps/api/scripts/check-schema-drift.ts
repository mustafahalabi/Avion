/**
 * CLI for the schema-drift check (MUS-265).
 *
 * Verifies that apps/api/prisma/schema.prisma (the api's hand-maintained
 * read-only projection) is a faithful SUBSET of the canonical
 * apps/web/prisma/schema.prisma. Canonical-only extras are fine; api-only
 * models/fields/attributes, retypes, or re-mappings fail with exit code 1.
 *
 * Usage:
 *   pnpm --filter @avion/api schema:check
 *   tsx scripts/check-schema-drift.ts [apiSchemaPath] [canonicalSchemaPath]
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { checkSchemaDrift } from "../src/schema-drift/schema-drift";

const apiSchemaPath =
  process.argv[2] ?? path.resolve(__dirname, "..", "prisma", "schema.prisma");
const canonicalSchemaPath =
  process.argv[3] ?? path.resolve(__dirname, "..", "..", "web", "prisma", "schema.prisma");

const result = checkSchemaDrift(
  readFileSync(apiSchemaPath, "utf8"),
  readFileSync(canonicalSchemaPath, "utf8"),
);

if (result.errors.length > 0) {
  console.error(
    `Schema drift detected: the api projection (${path.relative(process.cwd(), apiSchemaPath)}) ` +
      `no longer matches the canonical schema (${path.relative(process.cwd(), canonicalSchemaPath)}):\n`,
  );
  for (const error of result.errors) {
    console.error(`  ✗ ${error}`);
  }
  console.error(
    "\nFix: update apps/api/prisma/schema.prisma to mirror the canonical schema " +
      "(the api schema must stay a strict subset — see the header comment in that file).",
  );
  process.exit(1);
}

console.log(
  `Schema drift check passed: ${result.modelCount} models / ${result.fieldCount} fields in the api ` +
    "projection verified as a strict subset of the canonical schema.",
);
