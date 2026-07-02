import { describe, expect, it } from "vitest";

import {
  assessReleaseReadiness,
  parseReleaseChecklist,
} from "./release-readiness";

const CHECKLIST = [
  { id: "tests", label: "All tests passing", checked: true },
  { id: "review", label: "Code review approved", checked: true },
  { id: "qa", label: "QA validation passed", checked: false },
];

describe("parseReleaseChecklist", () => {
  it("parses well-formed items and drops malformed ones", () => {
    const json = JSON.stringify([...CHECKLIST, { id: 1, label: null }, "junk"]);
    const items = parseReleaseChecklist(json);
    expect(items).toHaveLength(3);
    expect(items[2].label).toBe("QA validation passed");
  });

  it("returns [] for null, invalid JSON, or a non-array", () => {
    expect(parseReleaseChecklist(null)).toEqual([]);
    expect(parseReleaseChecklist("not-json")).toEqual([]);
    expect(parseReleaseChecklist('{"a":1}')).toEqual([]);
  });
});

describe("assessReleaseReadiness", () => {
  it("is not ready while any item is unchecked, listing the missing labels", () => {
    const readiness = assessReleaseReadiness(JSON.stringify(CHECKLIST));
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(["QA validation passed"]);
  });

  it("is ready when every item is checked", () => {
    const all = CHECKLIST.map((item) => ({ ...item, checked: true }));
    const readiness = assessReleaseReadiness(JSON.stringify(all));
    expect(readiness.ready).toBe(true);
    expect(readiness.missing).toEqual([]);
  });

  it("treats a missing or empty checklist as NOT ready", () => {
    expect(assessReleaseReadiness(null).ready).toBe(false);
    expect(assessReleaseReadiness("[]").ready).toBe(false);
    expect(assessReleaseReadiness("garbage").ready).toBe(false);
  });
});
