import type { RouteInfo, RiskFinding, ScriptInfo } from "./repository-analyzer";

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Minimal shape required from a stored RepositoryAnalysisSnapshot for comparison.
 * All JSON fields are stored as serialized strings in the database.
 */
export interface SnapshotForComparison {
  id: string;
  repositoryId: string;
  companyId: string;
  analyzerVersion: string;
  status: string;
  error: string | null;
  fileTree: string;        // JSON: FileTreeSummary
  importantFiles: string;  // JSON: string[]
  routes: string;          // JSON: RouteInfo[]
  apiRoutes: string;       // JSON: string[]
  serverActions: string;   // JSON: string[]
  prismaModels: string;    // JSON: string[]
  dependencies: string;    // JSON: string[]
  devDependencies: string; // JSON: string[]
  scripts: string;         // JSON: ScriptInfo
  testFiles: string;       // JSON: string[]
  fileFingerprints?: string; // JSON: FileFingerprint[]
  risks: string;           // JSON: RiskFinding[]
  ignoredPaths: string;    // JSON: string[]
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface EvidenceItem {
  area: string;
  description: string;
  oldValue?: string;
  newValue?: string;
}

export interface StringListChanges {
  added: string[];
  removed: string[];
}

export interface RouteDetailChange {
  path: string;
  field: "type" | "evidence";
  oldValue: string;
  newValue: string;
}

export interface RouteChanges {
  added: RouteInfo[];
  removed: RouteInfo[];
  changed: RouteDetailChange[];
}

export interface DependencyChanges {
  added: string[];
  removed: string[];
  addedDev: string[];
  removedDev: string[];
}

export interface ScriptEntry {
  name: string;
  value: string;
}

export interface ScriptChange {
  name: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ScriptChanges {
  added: ScriptEntry[];
  removed: ScriptEntry[];
  changed: ScriptChange[];
}

export interface FileSummaryChange {
  totalFilesOld: number;
  totalFilesNew: number;
  totalFilesDelta: number;
  totalDirsOld: number;
  totalDirsNew: number;
  categoryChanges: Record<string, { old: number; new: number; delta: number }>;
}

export interface RiskEntry {
  severity: string;
  category: string;
  description: string;
}

export interface RiskChanges {
  new: RiskEntry[];
  resolved: RiskEntry[];
}

export interface TestChanges {
  added: string[];
  removed: string[];
  oldCount: number;
  newCount: number;
}

export interface ChangeCounts {
  changedFiles: number;
  addedImportantFiles: number;
  removedImportantFiles: number;
  addedRoutes: number;
  removedRoutes: number;
  changedRoutes: number;
  addedApiRoutes: number;
  removedApiRoutes: number;
  addedServerActions: number;
  removedServerActions: number;
  addedPrismaModels: number;
  removedPrismaModels: number;
  addedDependencies: number;
  removedDependencies: number;
  addedDevDependencies: number;
  removedDevDependencies: number;
  addedScripts: number;
  removedScripts: number;
  changedScripts: number;
  addedTestFiles: number;
  removedTestFiles: number;
  newRisks: number;
  resolvedRisks: number;
}

export interface SnapshotComparisonResult {
  oldSnapshotId: string;
  newSnapshotId: string;
  repositoryId: string;
  comparedAt: string;
  hasChanges: boolean;
  changeCounts: ChangeCounts;
  fileSummary: FileSummaryChange;
  addedFiles: string[];
  removedFiles: string[];
  changedFiles: string[];
  routeChanges: RouteChanges;
  apiRouteChanges: StringListChanges;
  serverActionChanges: StringListChanges;
  prismaModelChanges: StringListChanges;
  dependencyChanges: DependencyChanges;
  scriptChanges: ScriptChanges;
  testChanges: TestChanges;
  riskChanges: RiskChanges;
  affectedAreas: string[];
  evidence: EvidenceItem[];
  summary: string;
  limitations: string[];
}

export interface SnapshotComparisonError {
  error: true;
  reason: string;
  oldSnapshotId: string | null;
  newSnapshotId: string | null;
  repositoryId: string | null;
  comparedAt: string;
}

export type ComparisonOutcome = SnapshotComparisonResult | SnapshotComparisonError;

// ─── File Tree Shape ──────────────────────────────────────────────────────────

interface FileTreeSummary {
  totalFiles: number;
  totalDirs: number;
  byCategory: Record<string, number>;
  byExtension: Record<string, number>;
  topLevelDirs: string[];
}

interface FileFingerprint {
  path: string;
  extension?: string;
  size?: number;
  category?: string;
  contentHash: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseSafe<T>(json: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function diffStringLists(
  oldList: string[],
  newList: string[],
): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldList.map(normalizePath));
  const newSet = new Set(newList.map(normalizePath));
  const added = [...newSet].filter((p) => !oldSet.has(p)).sort();
  const removed = [...oldSet].filter((p) => !newSet.has(p)).sort();
  return { added, removed };
}

function compareFileFingerprints(
  oldFingerprints: FileFingerprint[],
  newFingerprints: FileFingerprint[],
): string[] {
  const oldMap = new Map(
    oldFingerprints
      .filter((entry) => typeof entry.path === "string" && typeof entry.contentHash === "string")
      .map((entry) => [normalizePath(entry.path), entry.contentHash]),
  );
  const newMap = new Map(
    newFingerprints
      .filter((entry) => typeof entry.path === "string" && typeof entry.contentHash === "string")
      .map((entry) => [normalizePath(entry.path), entry.contentHash]),
  );

  return [...newMap.entries()]
    .filter(([path, newHash]) => oldMap.has(path) && oldMap.get(path) !== newHash)
    .map(([path]) => path)
    .sort();
}

// ─── Area Comparators ─────────────────────────────────────────────────────────

function compareFileSummary(
  oldTree: FileTreeSummary,
  newTree: FileTreeSummary,
): FileSummaryChange {
  const allCategories = new Set([
    ...Object.keys(oldTree.byCategory ?? {}),
    ...Object.keys(newTree.byCategory ?? {}),
  ]);

  const categoryChanges: FileSummaryChange["categoryChanges"] = {};
  for (const cat of [...allCategories].sort()) {
    const oldVal = (oldTree.byCategory ?? {})[cat] ?? 0;
    const newVal = (newTree.byCategory ?? {})[cat] ?? 0;
    if (oldVal !== newVal) {
      categoryChanges[cat] = { old: oldVal, new: newVal, delta: newVal - oldVal };
    }
  }

  return {
    totalFilesOld: oldTree.totalFiles ?? 0,
    totalFilesNew: newTree.totalFiles ?? 0,
    totalFilesDelta: (newTree.totalFiles ?? 0) - (oldTree.totalFiles ?? 0),
    totalDirsOld: oldTree.totalDirs ?? 0,
    totalDirsNew: newTree.totalDirs ?? 0,
    categoryChanges,
  };
}

function compareRoutes(
  oldRoutes: RouteInfo[],
  newRoutes: RouteInfo[],
): RouteChanges {
  const oldMap = new Map(oldRoutes.map((r) => [normalizePath(r.path), r]));
  const newMap = new Map(newRoutes.map((r) => [normalizePath(r.path), r]));

  const added: RouteInfo[] = [];
  const removed: RouteInfo[] = [];
  const changed: RouteDetailChange[] = [];

  for (const [path, newRoute] of newMap) {
    if (!oldMap.has(path)) {
      added.push(newRoute);
    } else {
      const oldRoute = oldMap.get(path)!;
      if (oldRoute.type !== newRoute.type) {
        changed.push({ path, field: "type", oldValue: oldRoute.type, newValue: newRoute.type });
      }
    }
  }

  for (const [path, oldRoute] of oldMap) {
    if (!newMap.has(path)) {
      removed.push(oldRoute);
    }
  }

  return {
    added: added.sort((a, b) => a.path.localeCompare(b.path)),
    removed: removed.sort((a, b) => a.path.localeCompare(b.path)),
    changed: changed.sort((a, b) => a.path.localeCompare(b.path)),
  };
}

function compareScripts(
  oldScripts: ScriptInfo,
  newScripts: ScriptInfo,
): ScriptChanges {
  const keys: Array<keyof ScriptInfo> = ["dev", "build", "test", "lint", "typecheck"];
  const added: ScriptEntry[] = [];
  const removed: ScriptEntry[] = [];
  const changed: ScriptChange[] = [];

  for (const key of keys) {
    const oldVal = oldScripts[key] ?? null;
    const newVal = newScripts[key] ?? null;

    if (oldVal === null && newVal !== null) {
      added.push({ name: key, value: newVal });
    } else if (oldVal !== null && newVal === null) {
      removed.push({ name: key, value: oldVal });
    } else if (oldVal !== null && newVal !== null && oldVal !== newVal) {
      changed.push({ name: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return {
    added: added.sort((a, b) => a.name.localeCompare(b.name)),
    removed: removed.sort((a, b) => a.name.localeCompare(b.name)),
    changed: changed.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function compareRisks(
  oldRisks: RiskFinding[],
  newRisks: RiskFinding[],
): RiskChanges {
  const riskKey = (r: RiskFinding) => `${r.category}:${r.description}`;
  const oldKeys = new Set(oldRisks.map(riskKey));
  const newKeys = new Set(newRisks.map(riskKey));

  const newEntries = newRisks
    .filter((r) => !oldKeys.has(riskKey(r)))
    .map((r) => ({ severity: r.severity, category: r.category, description: r.description }))
    .sort((a, b) => a.description.localeCompare(b.description));

  const resolved = oldRisks
    .filter((r) => !newKeys.has(riskKey(r)))
    .map((r) => ({ severity: r.severity, category: r.category, description: r.description }))
    .sort((a, b) => a.description.localeCompare(b.description));

  return { new: newEntries, resolved };
}

// ─── Evidence Builder ─────────────────────────────────────────────────────────

function buildEvidence(
  importantFileChanges: StringListChanges,
  changedFiles: string[],
  routeChanges: RouteChanges,
  apiRouteChanges: StringListChanges,
  serverActionChanges: StringListChanges,
  prismaModelChanges: StringListChanges,
  dependencyChanges: DependencyChanges,
  scriptChanges: ScriptChanges,
  testChanges: TestChanges,
  riskChanges: RiskChanges,
): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  for (const f of importantFileChanges.added) {
    items.push({ area: "files", description: `Important file added: ${f}`, newValue: f });
  }
  for (const f of importantFileChanges.removed) {
    items.push({ area: "files", description: `Important file removed: ${f}`, oldValue: f });
  }
  for (const f of changedFiles) {
    items.push({ area: "files", description: `File content changed: ${f}`, oldValue: "previous hash", newValue: "new hash" });
  }

  for (const r of routeChanges.added) {
    items.push({ area: "routes", description: `Route added: ${r.path}`, newValue: `${r.path} (${r.type})` });
  }
  for (const r of routeChanges.removed) {
    items.push({ area: "routes", description: `Route removed: ${r.path}`, oldValue: `${r.path} (${r.type})` });
  }
  for (const c of routeChanges.changed) {
    items.push({ area: "routes", description: `Route changed: ${c.path}`, oldValue: c.oldValue, newValue: c.newValue });
  }

  for (const p of apiRouteChanges.added) {
    items.push({ area: "apiRoutes", description: `API route added: ${p}`, newValue: p });
  }
  for (const p of apiRouteChanges.removed) {
    items.push({ area: "apiRoutes", description: `API route removed: ${p}`, oldValue: p });
  }

  for (const p of serverActionChanges.added) {
    items.push({ area: "serverActions", description: `Server action added: ${p}`, newValue: p });
  }
  for (const p of serverActionChanges.removed) {
    items.push({ area: "serverActions", description: `Server action removed: ${p}`, oldValue: p });
  }

  for (const m of prismaModelChanges.added) {
    items.push({ area: "prismaModels", description: `Prisma model added: ${m}`, newValue: m });
  }
  for (const m of prismaModelChanges.removed) {
    items.push({ area: "prismaModels", description: `Prisma model removed: ${m}`, oldValue: m });
  }

  for (const d of dependencyChanges.added) {
    items.push({ area: "dependencies", description: `Dependency added: ${d}`, newValue: d });
  }
  for (const d of dependencyChanges.removed) {
    items.push({ area: "dependencies", description: `Dependency removed: ${d}`, oldValue: d });
  }
  for (const d of dependencyChanges.addedDev) {
    items.push({ area: "devDependencies", description: `Dev dependency added: ${d}`, newValue: d });
  }
  for (const d of dependencyChanges.removedDev) {
    items.push({ area: "devDependencies", description: `Dev dependency removed: ${d}`, oldValue: d });
  }

  for (const s of scriptChanges.added) {
    items.push({ area: "scripts", description: `Script added: ${s.name}`, newValue: s.value });
  }
  for (const s of scriptChanges.removed) {
    items.push({ area: "scripts", description: `Script removed: ${s.name}`, oldValue: s.value });
  }
  for (const s of scriptChanges.changed) {
    items.push({ area: "scripts", description: `Script changed: ${s.name}`, oldValue: s.oldValue ?? undefined, newValue: s.newValue ?? undefined });
  }

  for (const f of testChanges.added) {
    items.push({ area: "tests", description: `Test file added: ${f}`, newValue: f });
  }
  for (const f of testChanges.removed) {
    items.push({ area: "tests", description: `Test file removed: ${f}`, oldValue: f });
  }

  for (const r of riskChanges.new) {
    items.push({ area: "risks", description: `New risk (${r.severity}/${r.category}): ${r.description}`, newValue: r.severity });
  }
  for (const r of riskChanges.resolved) {
    items.push({ area: "risks", description: `Resolved risk (${r.severity}/${r.category}): ${r.description}`, oldValue: r.severity });
  }

  return items;
}

// ─── Affected Areas ───────────────────────────────────────────────────────────

function buildAffectedAreas(
  importantFileChanges: StringListChanges,
  changedFiles: string[],
  fileSummary: FileSummaryChange,
  routeChanges: RouteChanges,
  apiRouteChanges: StringListChanges,
  serverActionChanges: StringListChanges,
  prismaModelChanges: StringListChanges,
  dependencyChanges: DependencyChanges,
  scriptChanges: ScriptChanges,
  testChanges: TestChanges,
  riskChanges: RiskChanges,
): string[] {
  const areas = new Set<string>();

  if (importantFileChanges.added.length > 0 || importantFileChanges.removed.length > 0 || changedFiles.length > 0 || fileSummary.totalFilesDelta !== 0 || Object.keys(fileSummary.categoryChanges).length > 0) {
    areas.add("files");
  }
  if (routeChanges.added.length > 0 || routeChanges.removed.length > 0 || routeChanges.changed.length > 0) {
    areas.add("routes");
  }
  if (apiRouteChanges.added.length > 0 || apiRouteChanges.removed.length > 0) {
    areas.add("apiRoutes");
  }
  if (serverActionChanges.added.length > 0 || serverActionChanges.removed.length > 0) {
    areas.add("serverActions");
  }
  if (prismaModelChanges.added.length > 0 || prismaModelChanges.removed.length > 0) {
    areas.add("prismaModels");
  }
  if (dependencyChanges.added.length > 0 || dependencyChanges.removed.length > 0 || dependencyChanges.addedDev.length > 0 || dependencyChanges.removedDev.length > 0) {
    areas.add("dependencies");
  }
  if (scriptChanges.added.length > 0 || scriptChanges.removed.length > 0 || scriptChanges.changed.length > 0) {
    areas.add("scripts");
  }
  if (testChanges.added.length > 0 || testChanges.removed.length > 0) {
    areas.add("tests");
  }
  if (riskChanges.new.length > 0 || riskChanges.resolved.length > 0) {
    areas.add("risks");
  }

  return [...areas].sort();
}

// ─── Summary Builder ──────────────────────────────────────────────────────────

function buildSummary(
  affectedAreas: string[],
  changeCounts: ChangeCounts,
  fileSummary: FileSummaryChange,
): string {
  if (affectedAreas.length === 0) {
    return "No structural changes detected between the two snapshots.";
  }

  const parts: string[] = [];

  if (fileSummary.totalFilesDelta !== 0) {
    const direction = fileSummary.totalFilesDelta > 0 ? "grew" : "shrank";
    parts.push(`Repository ${direction} by ${Math.abs(fileSummary.totalFilesDelta)} file(s) (${fileSummary.totalFilesOld} → ${fileSummary.totalFilesNew}).`);
  }

  if (changeCounts.addedRoutes > 0 || changeCounts.removedRoutes > 0) {
    parts.push(`Routes: +${changeCounts.addedRoutes} added, -${changeCounts.removedRoutes} removed.`);
  }
  if (changeCounts.addedApiRoutes > 0 || changeCounts.removedApiRoutes > 0) {
    parts.push(`API routes: +${changeCounts.addedApiRoutes} added, -${changeCounts.removedApiRoutes} removed.`);
  }
  if (changeCounts.addedServerActions > 0 || changeCounts.removedServerActions > 0) {
    parts.push(`Server actions: +${changeCounts.addedServerActions} added, -${changeCounts.removedServerActions} removed.`);
  }
  if (changeCounts.addedPrismaModels > 0 || changeCounts.removedPrismaModels > 0) {
    parts.push(`Prisma models: +${changeCounts.addedPrismaModels} added, -${changeCounts.removedPrismaModels} removed.`);
  }
  if (changeCounts.addedDependencies > 0 || changeCounts.removedDependencies > 0 || changeCounts.addedDevDependencies > 0 || changeCounts.removedDevDependencies > 0) {
    const depAdded = changeCounts.addedDependencies + changeCounts.addedDevDependencies;
    const depRemoved = changeCounts.removedDependencies + changeCounts.removedDevDependencies;
    parts.push(`Dependencies: +${depAdded} added, -${depRemoved} removed.`);
  }
  if (changeCounts.addedScripts > 0 || changeCounts.removedScripts > 0 || changeCounts.changedScripts > 0) {
    parts.push(`Scripts changed (${changeCounts.addedScripts} added, ${changeCounts.removedScripts} removed, ${changeCounts.changedScripts} modified).`);
  }
  if (changeCounts.addedTestFiles > 0 || changeCounts.removedTestFiles > 0) {
    parts.push(`Test files: +${changeCounts.addedTestFiles} added, -${changeCounts.removedTestFiles} removed.`);
  }
  if (changeCounts.newRisks > 0 || changeCounts.resolvedRisks > 0) {
    parts.push(`Risk findings: ${changeCounts.newRisks} new, ${changeCounts.resolvedRisks} resolved.`);
  }

  return parts.length > 0
    ? `Changes detected in: ${affectedAreas.join(", ")}. ${parts.join(" ")}`
    : `Changes detected in: ${affectedAreas.join(", ")}.`;
}

// ─── Limitations ─────────────────────────────────────────────────────────────

const STATIC_LIMITATIONS: readonly string[] = [
  "Dependency version changes are not detectable: only package names are stored in snapshots.",
  "Only safe scanned text files receive content fingerprints; ignored files, secrets, large files, and binaries are not hashed.",
  "Prisma model field-level changes are not detectable: only model names are stored.",
  "Route evidence strings are excluded from change detection to avoid noise from re-analysis.",
];

// ─── Pure Comparison Entry Point ─────────────────────────────────────────────

/**
 * Compares two RepositoryAnalysisSnapshot payloads and returns a deterministic
 * structured diff. The `comparedAt` timestamp must be injected by the caller
 * to preserve pure-function determinism.
 *
 * The same two snapshots always produce the same result regardless of call order.
 */
export function compareSnapshots(
  oldSnapshot: SnapshotForComparison,
  newSnapshot: SnapshotForComparison,
  comparedAt: string,
): ComparisonOutcome {
  const errorBase = {
    oldSnapshotId: oldSnapshot.id ?? null,
    newSnapshotId: newSnapshot.id ?? null,
    repositoryId: oldSnapshot.repositoryId ?? newSnapshot.repositoryId ?? null,
    comparedAt,
  };

  if (!oldSnapshot.id || !newSnapshot.id) {
    return { error: true, reason: "One or both snapshots are missing an id.", ...errorBase };
  }

  if (oldSnapshot.status === "failed") {
    return { error: true, reason: `Old snapshot (${oldSnapshot.id}) has failed status: ${oldSnapshot.error ?? "unknown error"}.`, ...errorBase };
  }

  if (newSnapshot.status === "failed") {
    return { error: true, reason: `New snapshot (${newSnapshot.id}) has failed status: ${newSnapshot.error ?? "unknown error"}.`, ...errorBase };
  }

  if (oldSnapshot.repositoryId !== newSnapshot.repositoryId) {
    return { error: true, reason: `Snapshots belong to different repositories: ${oldSnapshot.repositoryId} vs ${newSnapshot.repositoryId}.`, ...errorBase };
  }

  const limitations: string[] = [...STATIC_LIMITATIONS];

  if (oldSnapshot.analyzerVersion !== newSnapshot.analyzerVersion) {
    limitations.unshift(
      `Analyzer version mismatch: old snapshot used version ${oldSnapshot.analyzerVersion}, new snapshot used version ${newSnapshot.analyzerVersion}. Results may reflect schema differences in addition to structural changes.`,
    );
  }

  // ─── Parse Fields ────────────────────────────────────────────────────────

  const emptyTree: FileTreeSummary = { totalFiles: 0, totalDirs: 0, byCategory: {}, byExtension: {}, topLevelDirs: [] };
  const emptyScripts: ScriptInfo = { dev: null, build: null, test: null, lint: null, typecheck: null };

  const oldTree = parseSafe<FileTreeSummary>(oldSnapshot.fileTree, emptyTree);
  const newTree = parseSafe<FileTreeSummary>(newSnapshot.fileTree, emptyTree);

  const oldImportantFiles = parseSafe<string[]>(oldSnapshot.importantFiles, []);
  const newImportantFiles = parseSafe<string[]>(newSnapshot.importantFiles, []);

  const oldRoutes = parseSafe<RouteInfo[]>(oldSnapshot.routes, []);
  const newRoutes = parseSafe<RouteInfo[]>(newSnapshot.routes, []);

  const oldApiRoutes = parseSafe<string[]>(oldSnapshot.apiRoutes, []);
  const newApiRoutes = parseSafe<string[]>(newSnapshot.apiRoutes, []);

  const oldServerActions = parseSafe<string[]>(oldSnapshot.serverActions, []);
  const newServerActions = parseSafe<string[]>(newSnapshot.serverActions, []);

  const oldPrismaModels = parseSafe<string[]>(oldSnapshot.prismaModels, []);
  const newPrismaModels = parseSafe<string[]>(newSnapshot.prismaModels, []);

  const oldDeps = parseSafe<string[]>(oldSnapshot.dependencies, []);
  const newDeps = parseSafe<string[]>(newSnapshot.dependencies, []);

  const oldDevDeps = parseSafe<string[]>(oldSnapshot.devDependencies, []);
  const newDevDeps = parseSafe<string[]>(newSnapshot.devDependencies, []);

  const oldScripts = parseSafe<ScriptInfo>(oldSnapshot.scripts, emptyScripts);
  const newScripts = parseSafe<ScriptInfo>(newSnapshot.scripts, emptyScripts);

  const oldTestFiles = parseSafe<string[]>(oldSnapshot.testFiles, []);
  const newTestFiles = parseSafe<string[]>(newSnapshot.testFiles, []);
  const oldFingerprints = parseSafe<FileFingerprint[]>(oldSnapshot.fileFingerprints ?? "[]", []);
  const newFingerprints = parseSafe<FileFingerprint[]>(newSnapshot.fileFingerprints ?? "[]", []);

  const oldRisks = parseSafe<RiskFinding[]>(oldSnapshot.risks, []);
  const newRisks = parseSafe<RiskFinding[]>(newSnapshot.risks, []);

  // ─── Compare Each Area ───────────────────────────────────────────────────

  const fileSummary = compareFileSummary(oldTree, newTree);
  const importantFileChanges = diffStringLists(oldImportantFiles, newImportantFiles);
  const changedFiles = compareFileFingerprints(oldFingerprints, newFingerprints);
  const routeChanges = compareRoutes(oldRoutes, newRoutes);
  const apiRouteChanges = diffStringLists(oldApiRoutes, newApiRoutes);
  const serverActionChanges = diffStringLists(oldServerActions, newServerActions);
  const prismaModelChanges = diffStringLists(oldPrismaModels, newPrismaModels);
  const depDiff = diffStringLists(oldDeps, newDeps);
  const devDepDiff = diffStringLists(oldDevDeps, newDevDeps);
  const scriptChanges = compareScripts(oldScripts, newScripts);

  const testChanges: TestChanges = {
    ...diffStringLists(oldTestFiles, newTestFiles),
    oldCount: oldTestFiles.length,
    newCount: newTestFiles.length,
  };

  const riskChanges = compareRisks(oldRisks, newRisks);

  const dependencyChanges: DependencyChanges = {
    added: depDiff.added,
    removed: depDiff.removed,
    addedDev: devDepDiff.added,
    removedDev: devDepDiff.removed,
  };

  // ─── Aggregate ───────────────────────────────────────────────────────────

  const changeCounts: ChangeCounts = {
    changedFiles: changedFiles.length,
    addedImportantFiles: importantFileChanges.added.length,
    removedImportantFiles: importantFileChanges.removed.length,
    addedRoutes: routeChanges.added.length,
    removedRoutes: routeChanges.removed.length,
    changedRoutes: routeChanges.changed.length,
    addedApiRoutes: apiRouteChanges.added.length,
    removedApiRoutes: apiRouteChanges.removed.length,
    addedServerActions: serverActionChanges.added.length,
    removedServerActions: serverActionChanges.removed.length,
    addedPrismaModels: prismaModelChanges.added.length,
    removedPrismaModels: prismaModelChanges.removed.length,
    addedDependencies: dependencyChanges.added.length,
    removedDependencies: dependencyChanges.removed.length,
    addedDevDependencies: dependencyChanges.addedDev.length,
    removedDevDependencies: dependencyChanges.removedDev.length,
    addedScripts: scriptChanges.added.length,
    removedScripts: scriptChanges.removed.length,
    changedScripts: scriptChanges.changed.length,
    addedTestFiles: testChanges.added.length,
    removedTestFiles: testChanges.removed.length,
    newRisks: riskChanges.new.length,
    resolvedRisks: riskChanges.resolved.length,
  };

  const affectedAreas = buildAffectedAreas(
    importantFileChanges,
    changedFiles,
    fileSummary,
    routeChanges,
    apiRouteChanges,
    serverActionChanges,
    prismaModelChanges,
    dependencyChanges,
    scriptChanges,
    testChanges,
    riskChanges,
  );

  const hasChanges = affectedAreas.length > 0;

  const evidence = buildEvidence(
    importantFileChanges,
    changedFiles,
    routeChanges,
    apiRouteChanges,
    serverActionChanges,
    prismaModelChanges,
    dependencyChanges,
    scriptChanges,
    testChanges,
    riskChanges,
  );

  const summary = buildSummary(affectedAreas, changeCounts, fileSummary);

  return {
    oldSnapshotId: oldSnapshot.id,
    newSnapshotId: newSnapshot.id,
    repositoryId: oldSnapshot.repositoryId,
    comparedAt,
    hasChanges,
    changeCounts,
    fileSummary,
    addedFiles: importantFileChanges.added,
    removedFiles: importantFileChanges.removed,
    changedFiles,
    routeChanges,
    apiRouteChanges,
    serverActionChanges,
    prismaModelChanges,
    dependencyChanges,
    scriptChanges,
    testChanges,
    riskChanges,
    affectedAreas,
    evidence,
    summary,
    limitations,
  };
}
