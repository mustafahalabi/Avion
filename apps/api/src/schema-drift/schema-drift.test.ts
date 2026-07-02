import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { checkSchemaDrift, parsePrismaSchema } from "./schema-drift";

/** Canonical (web-style) fixture: richer than any projection needs to be. */
const CANONICAL = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  clerkId   String?  @unique
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  ownedCompanies Company[] @relation("CompanyOwner")
}

model Company {
  id      String @id @default(cuid())
  name    String
  slug    String @unique
  ownerId String

  owner User @relation("CompanyOwner", fields: [ownerId], references: [id])

  @@index([ownerId])
}

model Task {
  id        String   @id @default(cuid())
  companyId String
  title     String
  status    String   @default("todo")
  estimate  Float?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, id])
  @@index([companyId, status])
}
`;

/** A faithful read-only projection of CANONICAL. */
const PROJECTION_IN_SYNC = `
datasource db {
  provider = "postgresql"
}

model User {
  id      String  @id
  clerkId String? @unique

  @@map("User")
}

model Task {
  id        String   @id
  companyId String
  status    String   @default("todo")
  updatedAt DateTime @updatedAt

  @@index([companyId, status])
  @@map("Task")
}
`;

describe("checkSchemaDrift — subset comparison", () => {
  it("passes when the api projection is an identical subset", () => {
    const result = checkSchemaDrift(PROJECTION_IN_SYNC, CANONICAL);
    expect(result.errors).toEqual([]);
    expect(result.modelCount).toBe(2);
    expect(result.fieldCount).toBe(6);
  });

  it("tolerates canonical-only extras (models, fields, write-side attributes, indexes)", () => {
    // Company + email/createdAt/relations exist only in the canonical schema;
    // @default(cuid()) on ids exists only there too — none of it is drift.
    const result = checkSchemaDrift(PROJECTION_IN_SYNC, CANONICAL);
    expect(result.errors).toEqual([]);
  });

  it("fails when the canonical schema no longer has a field the api reads", () => {
    const canonicalWithoutClerkId = CANONICAL.replace("clerkId   String?  @unique\n", "");
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, canonicalWithoutClerkId);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"User.clerkId"');
    expect(errors[0]).toContain("not in the canonical schema");
  });

  it("fails when a field was retyped in the canonical schema", () => {
    const retyped = CANONICAL.replace("status    String   @default(\"todo\")", "status    Int      @default(0)");
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, retyped);
    expect(errors.some((e) => e.includes('"Task.status"') && e.includes("type mismatch"))).toBe(true);
  });

  it("fails when optionality diverges", () => {
    const nowOptional = CANONICAL.replace("companyId String", "companyId String?");
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, nowOptional);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"Task.companyId"');
    expect(errors[0]).toContain("api: String, canonical: String?");
  });

  it("fails on an api-only field", () => {
    const projection = PROJECTION_IN_SYNC.replace("clerkId String? @unique", "clerkId String? @unique\n  ghost   String?");
    const { errors } = checkSchemaDrift(projection, CANONICAL);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"User.ghost"');
    expect(errors[0]).toContain("exists in the api projection but not in the canonical schema");
  });

  it("fails on an api-only model", () => {
    const projection = `${PROJECTION_IN_SYNC}\nmodel Ghost {\n  id String @id\n}\n`;
    const { errors } = checkSchemaDrift(projection, CANONICAL);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('model "Ghost"');
  });

  it("fails on an api-only field attribute (e.g. an invented @unique)", () => {
    const projection = PROJECTION_IN_SYNC.replace("companyId String", "companyId String @unique");
    const { errors } = checkSchemaDrift(projection, CANONICAL);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("@unique exists only in the api projection");
  });

  it("fails when a shared attribute's arguments diverge (e.g. @default)", () => {
    const canonicalNewDefault = CANONICAL.replace('status    String   @default("todo")', 'status    String   @default("open")');
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, canonicalNewDefault);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("@default mismatch");
    expect(errors[0]).toContain('"todo"');
    expect(errors[0]).toContain('"open"');
  });

  it("fails when the effective table names diverge (@@map)", () => {
    const remapped = CANONICAL.replace("model Task {", 'model Task {\n  @@map("tasks")');
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, remapped);
    expect(errors.some((e) => e.includes('model "Task"') && e.includes("table name mismatch"))).toBe(true);
  });

  it("fails when the effective column names diverge (@map)", () => {
    const remapped = CANONICAL.replace('status    String   @default("todo")', 'status    String   @default("todo") @map("state")');
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, remapped);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('"Task.status"');
    expect(errors[0]).toContain('mapped column name mismatch (api: "status", canonical: "state")');
  });

  it("fails on an api-only block attribute (e.g. an index the canonical schema dropped)", () => {
    const withoutIndex = CANONICAL.replace("@@index([companyId, status])\n", "");
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, withoutIndex);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("@@index([companyId,status]) exists only in the api projection");
  });

  it("fails when datasource providers diverge", () => {
    const sqlite = CANONICAL.replace('provider = "postgresql"', 'provider = "sqlite"');
    const { errors } = checkSchemaDrift(PROJECTION_IN_SYNC, sqlite);
    expect(errors.some((e) => e.includes("datasource provider mismatch"))).toBe(true);
  });

  it("requires api enums to match the canonical enum values exactly", () => {
    const canonical = `${CANONICAL}\nenum Status {\n  todo\n  doing\n  done\n}\n`;
    const inSync = `${PROJECTION_IN_SYNC}\nenum Status {\n  todo\n  doing\n  done\n}\n`;
    expect(checkSchemaDrift(inSync, canonical).errors).toEqual([]);

    const missingValue = `${PROJECTION_IN_SYNC}\nenum Status {\n  todo\n  doing\n}\n`;
    const missingErrors = checkSchemaDrift(missingValue, canonical).errors;
    expect(missingErrors).toHaveLength(1);
    expect(missingErrors[0]).toContain('canonical value "done" is missing from the api projection');

    const extraValue = `${PROJECTION_IN_SYNC}\nenum Status {\n  todo\n  doing\n  done\n  ghost\n}\n`;
    const extraErrors = checkSchemaDrift(extraValue, canonical).errors;
    expect(extraErrors).toHaveLength(1);
    expect(extraErrors[0]).toContain('value "ghost" exists only in the api projection');

    const missingEnum = checkSchemaDrift(inSync, CANONICAL).errors;
    expect(missingEnum).toHaveLength(1);
    expect(missingEnum[0]).toContain('enum "Status" exists in the api projection but not in the canonical schema');
  });
});

describe("parsePrismaSchema — tolerant parsing", () => {
  it("ignores comments (including // inside strings) and joins multi-line attribute args", () => {
    const schema = parsePrismaSchema(`
// leading comment
model Thing {
  id   String @id // trailing comment
  /// doc comment
  url  String @default("https://example.com") // "//" inside the string survives
  rel  Other  @relation(fields: [otherId],
                        references: [id])
  otherId String
}

model Other {
  id String @id
}
`);
    const thing = schema.models.get("Thing");
    expect(thing).toBeDefined();
    expect([...thing!.fields.keys()]).toEqual(["id", "url", "rel", "otherId"]);
    expect(thing!.fields.get("url")!.attributes.get("default")).toBe('"https://example.com"');
    expect(thing!.fields.get("rel")!.attributes.get("relation")).toBe(
      "fields:[otherId],references:[id]",
    );
  });

  it("captures list/optional markers and effective names", () => {
    const schema = parsePrismaSchema(`
model M {
  tags  String[]
  note  String?  @map("note_col")

  @@map("m_table")
  @@index([tags])
}
`);
    const m = schema.models.get("M")!;
    expect(m.tableName).toBe("m_table");
    expect(m.fields.get("tags")!.isList).toBe(true);
    expect(m.fields.get("note")!.isOptional).toBe(true);
    expect(m.fields.get("note")!.columnName).toBe("note_col");
    expect(m.blockAttributes.get("index")).toEqual(["[tags]"]);
  });
});

describe("real schemas — the shipped api projection tracks the canonical schema", () => {
  // vitest runs with cwd = apps/api (pnpm --filter); tolerate a repo-root cwd too.
  function repoFile(fromApiDir: string): string {
    const candidates = [
      path.resolve(process.cwd(), fromApiDir),
      path.resolve(process.cwd(), "apps", "api", fromApiDir),
    ];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) throw new Error(`Could not locate ${fromApiDir} from ${process.cwd()}`);
    return found;
  }

  it("apps/api/prisma/schema.prisma is an in-sync subset of apps/web/prisma/schema.prisma", () => {
    const apiSchema = readFileSync(repoFile("prisma/schema.prisma"), "utf8");
    const webSchema = readFileSync(repoFile("../web/prisma/schema.prisma"), "utf8");
    const result = checkSchemaDrift(apiSchema, webSchema);
    expect(result.errors).toEqual([]);
    expect(result.modelCount).toBeGreaterThanOrEqual(5);
  });
});
