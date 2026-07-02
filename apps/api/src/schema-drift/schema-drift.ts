/**
 * Schema-drift checker (MUS-265).
 *
 * apps/api/prisma/schema.prisma is a hand-maintained READ-ONLY projection of
 * the canonical apps/web/prisma/schema.prisma. Nothing in Prisma enforces that
 * the projection stays in sync — a rename/retype in the canonical schema would
 * silently break the board at runtime. This module implements a tolerant,
 * dependency-free .prisma parser plus a model/field SUBSET comparison:
 *
 *   - every model, field, enum, and block attribute declared in the api
 *     projection must exist in the canonical schema with an identical
 *     type/optionality/column/table shape;
 *   - canonical-only extras (models, fields, attributes the api never reads,
 *     e.g. `@default(cuid())` on ids) are fine — the api never writes;
 *   - api-only additions are drift and fail the check.
 *
 * The parser is intentionally tolerant: it understands comments, strings,
 * multi-line attribute argument lists, `model`/`enum`/`datasource` blocks, and
 * ignores everything else. It is NOT a full Prisma grammar — it only needs to
 * be truthful about the shapes the comparison inspects.
 */

export interface PrismaField {
  name: string;
  /** Base type without list/optional markers, e.g. "String", "DateTime". */
  type: string;
  isOptional: boolean;
  isList: boolean;
  /** Effective column name: `@map` argument, else the field name. */
  columnName: string;
  /** Attribute name → normalized args ("" when none). `@map` is excluded (see columnName). */
  attributes: Map<string, string>;
}

export interface PrismaModel {
  name: string;
  /** Effective table name: `@@map` argument, else the model name. */
  tableName: string;
  fields: Map<string, PrismaField>;
  /** Block attribute name (without @@, excluding "map") → normalized args list (repeatable, e.g. @@index). */
  blockAttributes: Map<string, string[]>;
}

export interface PrismaSchemaInfo {
  /** Datasource provider, e.g. "postgresql", when declared. */
  provider?: string;
  models: Map<string, PrismaModel>;
  enums: Map<string, string[]>;
}

/** Remove `//` line comments (including `///` doc comments) outside string literals. */
function stripComments(source: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += source[++i];
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Collapse all whitespace outside string literals so attribute args compare canonically. */
function normalizeArgs(args: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i];
    if (inString) {
      out += ch;
      if (ch === "\\" && i + 1 < args.length) {
        out += args[++i];
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (!/\s/.test(ch)) out += ch;
  }
  return out;
}

/** Depth of unclosed ( and [ outside strings — used to join multi-line declarations. */
function openDepth(line: string): number {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
  }
  return depth;
}

/** Split a declaration into the part before the first top-level `@` and the attribute text. */
function splitAttributes(decl: string): { head: string; attrText: string } {
  let inString = false;
  let depth = 0;
  for (let i = 0; i < decl.length; i++) {
    const ch = decl[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "@" && depth === 0) {
      return { head: decl.slice(0, i), attrText: decl.slice(i) };
    }
  }
  return { head: decl, attrText: "" };
}

/** Parse `@name(args) @other ...` into name → normalized args. `@@` prefixes are stripped by callers. */
function parseAttributes(attrText: string): Array<{ name: string; args: string }> {
  const attrs: Array<{ name: string; args: string }> = [];
  let i = 0;
  while (i < attrText.length) {
    if (attrText[i] !== "@") {
      i++;
      continue;
    }
    i++;
    if (attrText[i] === "@") i++; // block attribute marker
    let name = "";
    while (i < attrText.length && /[\w.]/.test(attrText[i])) name += attrText[i++];
    let args = "";
    if (attrText[i] === "(") {
      let depth = 0;
      let inString = false;
      const start = ++i;
      for (; i < attrText.length; i++) {
        const ch = attrText[i];
        if (inString) {
          if (ch === "\\") i++;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "(") depth++;
        else if (ch === ")") {
          if (depth === 0) break;
          depth--;
        }
      }
      args = normalizeArgs(attrText.slice(start, i));
      i++; // past the closing paren
    }
    if (name) attrs.push({ name, args });
  }
  return attrs;
}

/** Strip surrounding quotes from a normalized single string argument. */
function unquote(value: string): string {
  const match = /^"(.*)"$/.exec(value);
  return match ? match[1] : value;
}

/** Join lines whose parens/brackets are still open (multi-line declarations). */
function logicalLines(body: string): string[] {
  const lines: string[] = [];
  let pending = "";
  let depth = 0;
  for (const raw of body.split("\n")) {
    pending = pending ? `${pending} ${raw.trim()}` : raw.trim();
    depth = openDepth(pending);
    if (depth > 0) continue;
    if (pending) lines.push(pending);
    pending = "";
  }
  if (pending) lines.push(pending);
  return lines;
}

function parseModelBody(name: string, body: string): PrismaModel {
  const model: PrismaModel = {
    name,
    tableName: name,
    fields: new Map(),
    blockAttributes: new Map(),
  };
  for (const line of logicalLines(body)) {
    if (line.startsWith("@@")) {
      const [attr] = parseAttributes(line);
      if (!attr) continue;
      if (attr.name === "map") {
        model.tableName = unquote(attr.args);
        continue;
      }
      const existing = model.blockAttributes.get(attr.name) ?? [];
      existing.push(attr.args);
      model.blockAttributes.set(attr.name, existing);
      continue;
    }
    const { head, attrText } = splitAttributes(line);
    const tokens = head.trim().split(/\s+/);
    if (tokens.length < 2) continue; // not a field declaration — tolerate
    const [fieldName, rawType] = tokens;
    if (!/^\w+$/.test(fieldName)) continue;
    let type = rawType;
    const isOptional = type.endsWith("?");
    if (isOptional) type = type.slice(0, -1);
    const isList = type.endsWith("[]");
    if (isList) type = type.slice(0, -2);
    const field: PrismaField = {
      name: fieldName,
      type,
      isOptional,
      isList,
      columnName: fieldName,
      attributes: new Map(),
    };
    for (const attr of parseAttributes(attrText)) {
      if (attr.name === "map") {
        field.columnName = unquote(attr.args);
      } else {
        field.attributes.set(attr.name, attr.args);
      }
    }
    model.fields.set(fieldName, field);
  }
  return model;
}

function parseEnumBody(body: string): string[] {
  const values: string[] = [];
  for (const line of logicalLines(body)) {
    if (line.startsWith("@@")) continue;
    const [value] = line.split(/\s+/);
    if (value && /^\w+$/.test(value)) values.push(value);
  }
  return values;
}

export function parsePrismaSchema(source: string): PrismaSchemaInfo {
  const clean = stripComments(source);
  const schema: PrismaSchemaInfo = { models: new Map(), enums: new Map() };
  const blockStart = /\b(model|enum|datasource|generator)\s+(\w+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = blockStart.exec(clean)) !== null) {
    const [, kind, name] = match;
    // Find the matching close brace (block bodies do not nest braces).
    let depth = 1;
    let inString = false;
    let i = blockStart.lastIndex;
    for (; i < clean.length && depth > 0; i++) {
      const ch = clean[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    const body = clean.slice(blockStart.lastIndex, i - 1);
    blockStart.lastIndex = i;
    if (kind === "model") {
      schema.models.set(name, parseModelBody(name, body));
    } else if (kind === "enum") {
      schema.enums.set(name, parseEnumBody(body));
    } else if (kind === "datasource") {
      const provider = /provider\s*=\s*"([^"]+)"/.exec(body);
      if (provider) schema.provider = provider[1];
    }
  }
  return schema;
}

function renderType(field: PrismaField): string {
  return `${field.type}${field.isList ? "[]" : ""}${field.isOptional ? "?" : ""}`;
}

/**
 * Subset comparison: every shape the api projection declares must exist
 * identically in the canonical (web) schema. Returns human-readable drift
 * errors; an empty array means the projection is in sync.
 */
export function comparePrismaSchemas(api: PrismaSchemaInfo, canonical: PrismaSchemaInfo): string[] {
  const errors: string[] = [];

  if (api.provider && canonical.provider && api.provider !== canonical.provider) {
    errors.push(
      `datasource provider mismatch: api declares "${api.provider}" but the canonical schema declares "${canonical.provider}"`,
    );
  }

  for (const [modelName, apiModel] of api.models) {
    const webModel = canonical.models.get(modelName);
    if (!webModel) {
      errors.push(`model "${modelName}" exists in the api projection but not in the canonical schema`);
      continue;
    }
    if (apiModel.tableName !== webModel.tableName) {
      errors.push(
        `model "${modelName}": mapped table name mismatch (api: "${apiModel.tableName}", canonical: "${webModel.tableName}")`,
      );
    }

    for (const [fieldName, apiField] of apiModel.fields) {
      const webField = webModel.fields.get(fieldName);
      const at = `${modelName}.${fieldName}`;
      if (!webField) {
        errors.push(`field "${at}" exists in the api projection but not in the canonical schema`);
        continue;
      }
      if (
        apiField.type !== webField.type ||
        apiField.isList !== webField.isList ||
        apiField.isOptional !== webField.isOptional
      ) {
        errors.push(
          `field "${at}": type mismatch (api: ${renderType(apiField)}, canonical: ${renderType(webField)})`,
        );
      }
      if (apiField.columnName !== webField.columnName) {
        errors.push(
          `field "${at}": mapped column name mismatch (api: "${apiField.columnName}", canonical: "${webField.columnName}")`,
        );
      }
      // Every attribute the api declares must exist identically in the
      // canonical schema. Canonical-only attributes (e.g. @default(cuid()),
      // @unique) are tolerated: they only affect writes, which the api never
      // performs — @map divergence is caught via columnName above.
      for (const [attrName, attrArgs] of apiField.attributes) {
        const webArgs = webField.attributes.get(attrName);
        if (webArgs === undefined) {
          errors.push(`field "${at}": attribute @${attrName} exists only in the api projection`);
        } else if (webArgs !== attrArgs) {
          errors.push(
            `field "${at}": attribute @${attrName} mismatch (api: @${attrName}(${attrArgs}), canonical: @${attrName}(${webArgs}))`,
          );
        }
      }
    }

    for (const [attrName, apiArgsList] of apiModel.blockAttributes) {
      const webArgsList = webModel.blockAttributes.get(attrName) ?? [];
      for (const args of apiArgsList) {
        if (!webArgsList.includes(args)) {
          errors.push(
            `model "${modelName}": block attribute @@${attrName}(${args}) exists only in the api projection`,
          );
        }
      }
    }
  }

  for (const [enumName, apiValues] of api.enums) {
    const webValues = canonical.enums.get(enumName);
    if (!webValues) {
      errors.push(`enum "${enumName}" exists in the api projection but not in the canonical schema`);
      continue;
    }
    // Enum value sets must match exactly: an api-only value is an api-only
    // addition; a canonical-only value would arrive from the database and fail
    // the api client's validation at read time.
    const apiOnly = apiValues.filter((v) => !webValues.includes(v));
    const webOnly = webValues.filter((v) => !apiValues.includes(v));
    for (const value of apiOnly) {
      errors.push(`enum "${enumName}": value "${value}" exists only in the api projection`);
    }
    for (const value of webOnly) {
      errors.push(
        `enum "${enumName}": canonical value "${value}" is missing from the api projection (reads returning it would fail)`,
      );
    }
  }

  return errors;
}

export interface DriftCheckResult {
  errors: string[];
  modelCount: number;
  fieldCount: number;
  enumCount: number;
}

/** Convenience wrapper: parse both sources and compare. */
export function checkSchemaDrift(apiSource: string, canonicalSource: string): DriftCheckResult {
  const api = parsePrismaSchema(apiSource);
  const canonical = parsePrismaSchema(canonicalSource);
  let fieldCount = 0;
  for (const model of api.models.values()) fieldCount += model.fields.size;
  return {
    errors: comparePrismaSchemas(api, canonical),
    modelCount: api.models.size,
    fieldCount,
    enumCount: api.enums.size,
  };
}
