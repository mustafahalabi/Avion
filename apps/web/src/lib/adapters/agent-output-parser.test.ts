import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  parseFilesChanged,
  parseFilesChangedFromGit,
} from "./agent-output-parser";

describe("parseFilesChanged (MUS-278)", () => {
  it("captures the inline Files changed value, not the following summary fields", () => {
    // The exact shape that fooled the old parser in the MUS-266 run: a
    // "- Files changed:" bullet followed by other Implementation-Summary fields.
    const stdout = [
      "## Implementation Summary",
      "- What changed: updated the greeting copy",
      "- Files changed: lib/greeting.mjs",
      '- Tests added: none — test updates are explicitly out of scope; QA team owns them',
      '- Validation: greeting("Avion") === "Hi, Avion!" verified directly',
      "- Remaining risks: none",
      "- Ready for review: Yes",
    ].join("\n");

    expect(parseFilesChanged(stdout)).toEqual(["lib/greeting.mjs"]);
  });

  it("records nothing (not the summary labels) when Files changed is empty", () => {
    const stdout = [
      "- Files changed:",
      "- Tests added: none",
      "- Ready for review: Yes",
    ].join("\n");
    expect(parseFilesChanged(stdout)).toEqual([]);
  });

  it("still parses Created / Modified / Deleted prefixes", () => {
    expect(
      parseFilesChanged(
        "Modified: src/foo.ts\nCreated: src/bar.ts\nDeleted: src/old.ts"
      )
    ).toEqual(["src/foo.ts", "src/bar.ts", "src/old.ts"]);
  });

  it("parses a comma-separated inline Files changed list", () => {
    expect(parseFilesChanged("Files changed: a/b.ts, c/d.tsx")).toEqual([
      "a/b.ts",
      "c/d.tsx",
    ]);
  });
});

describe("parseFilesChangedFromGit (MUS-278)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function initRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), "eos-parser-"));
    dirs.push(dir);
    const run = (cmd: string) => execSync(cmd, { cwd: dir, stdio: "pipe" });
    run("git init -q");
    run("git config user.email test@example.com");
    run("git config user.name test");
    writeFileSync(join(dir, "base.txt"), "base\n");
    run("git add -A");
    run("git commit -q -m base");
    return dir;
  }

  it("reports uncommitted modified + untracked files (a HEAD~1 diff would miss these)", () => {
    const dir = initRepo();
    // The agent's edits are uncommitted at parse time — the previous behavior
    // (`git diff HEAD~1`) would both fail (no HEAD~1 on a single commit) and miss
    // the working-tree changes.
    writeFileSync(join(dir, "base.txt"), "changed\n");
    writeFileSync(join(dir, "new.mjs"), "export const x = 1;\n");

    expect(parseFilesChangedFromGit(dir).sort()).toEqual(["base.txt", "new.mjs"]);
  });

  it("returns [] for a non-git directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "eos-nogit-"));
    dirs.push(dir);
    expect(parseFilesChangedFromGit(dir)).toEqual([]);
  });
});
