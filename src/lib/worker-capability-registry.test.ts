import { describe, expect, it } from "vitest";
import {
  WORKER_CAPABILITY_REGISTRY,
  canRoleHandleTask,
  getCapabilitiesForAgentType,
  getCapabilitiesForTaskType,
  getCapability,
  type WorkerCapability,
} from "./worker-capability-registry";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_SLUGS = Object.keys(WORKER_CAPABILITY_REGISTRY);

const EXPECTED_SLUGS = [
  "cto",
  "product_manager",
  "tech_lead",
  "frontend_engineer",
  "backend_engineer",
  "ai_engineer",
  "infrastructure_engineer",
  "reviewer",
  "qa_engineer",
  "security_engineer",
  "devops_engineer",
  "release_manager",
  "monitoring_engineer",
  "technical_writer",
] as const;

// ─── Registry shape ───────────────────────────────────────────────────────────

describe("WORKER_CAPABILITY_REGISTRY", () => {
  it("contains exactly 14 roles", () => {
    expect(ALL_SLUGS).toHaveLength(14);
  });

  it("contains every expected role slug", () => {
    for (const slug of EXPECTED_SLUGS) {
      expect(ALL_SLUGS).toContain(slug);
    }
  });

  it("every entry has its id matching the registry key", () => {
    for (const [key, cap] of Object.entries(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.id).toBe(key);
    }
  });

  it("every entry has a non-empty name and description", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.name.trim().length).toBeGreaterThan(0);
      expect(cap.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one task type", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.taskTypes.length).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one supported agent type", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.supportedAgentTypes.length).toBeGreaterThan(0);
    }
  });

  it("every entry's supported agent types are valid ExecutionSessionAgentType values", () => {
    const valid = new Set(["claude_code", "codex", "human"]);
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      for (const agentType of cap.supportedAgentTypes) {
        expect(valid).toContain(agentType);
      }
    }
  });

  it("every entry has positive maxConcurrentTasks", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.maxConcurrentTasks).toBeGreaterThan(0);
    }
  });

  it("every entry has min duration <= max duration", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.estimatedTaskDurationMinutes.min).toBeLessThanOrEqual(
        cap.estimatedTaskDurationMinutes.max
      );
    }
  });

  it("every entry has at least one required context item", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.requiredContext.length).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one produced output", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(cap.producedOutputs.length).toBeGreaterThan(0);
    }
  });

  it("canReviewOwnWork is a boolean on every entry", () => {
    for (const cap of Object.values(WORKER_CAPABILITY_REGISTRY)) {
      expect(typeof cap.canReviewOwnWork).toBe("boolean");
    }
  });

  it("reviewer role does not allow self-review (dedicated role for external review)", () => {
    expect(WORKER_CAPABILITY_REGISTRY.reviewer.canReviewOwnWork).toBe(false);
  });
});

// ─── getCapability ────────────────────────────────────────────────────────────

describe("getCapability", () => {
  it("returns the correct capability for a known slug", () => {
    const cap = getCapability("frontend_engineer");
    expect(cap).not.toBeNull();
    expect(cap?.id).toBe("frontend_engineer");
    expect(cap?.name).toBe("Frontend Engineer");
  });

  it("returns null for an unknown slug", () => {
    expect(getCapability("unicorn_role")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getCapability("")).toBeNull();
  });

  it("returns capabilities for every expected slug", () => {
    for (const slug of EXPECTED_SLUGS) {
      const cap = getCapability(slug);
      expect(cap).not.toBeNull();
    }
  });

  it("returned capability is a complete WorkerCapability object", () => {
    const cap = getCapability("backend_engineer") as WorkerCapability;
    expect(cap).toHaveProperty("id");
    expect(cap).toHaveProperty("name");
    expect(cap).toHaveProperty("description");
    expect(cap).toHaveProperty("taskTypes");
    expect(cap).toHaveProperty("supportedAgentTypes");
    expect(cap).toHaveProperty("maxConcurrentTasks");
    expect(cap).toHaveProperty("estimatedTaskDurationMinutes");
    expect(cap).toHaveProperty("requiredContext");
    expect(cap).toHaveProperty("producedOutputs");
    expect(cap).toHaveProperty("canReviewOwnWork");
  });
});

// ─── getCapabilitiesForTaskType ───────────────────────────────────────────────

describe("getCapabilitiesForTaskType", () => {
  it("returns multiple roles for a common task type like 'feature'", () => {
    const caps = getCapabilitiesForTaskType("feature");
    expect(caps.length).toBeGreaterThanOrEqual(3);
    const ids = caps.map((c) => c.id);
    expect(ids).toContain("frontend_engineer");
    expect(ids).toContain("backend_engineer");
    expect(ids).toContain("ai_engineer");
  });

  it("returns only roles that list the given task type", () => {
    const caps = getCapabilitiesForTaskType("security_review");
    for (const cap of caps) {
      expect(cap.taskTypes).toContain("security_review");
    }
  });

  it("returns an empty array for an unrecognised task type", () => {
    expect(getCapabilitiesForTaskType("does_not_exist")).toHaveLength(0);
  });

  it("returns the reviewer role for code_review task type", () => {
    const caps = getCapabilitiesForTaskType("code_review");
    const ids = caps.map((c) => c.id);
    expect(ids).toContain("reviewer");
  });

  it("returns the qa_engineer role for bug_report task type", () => {
    const caps = getCapabilitiesForTaskType("bug_report");
    const ids = caps.map((c) => c.id);
    expect(ids).toContain("qa_engineer");
  });

  it("returns the technical_writer role for documentation task type", () => {
    const caps = getCapabilitiesForTaskType("documentation");
    const ids = caps.map((c) => c.id);
    expect(ids).toContain("technical_writer");
  });

  it("returns the product_manager role for requirements_definition task type", () => {
    const caps = getCapabilitiesForTaskType("requirements_definition");
    const ids = caps.map((c) => c.id);
    expect(ids).toContain("product_manager");
  });

  it("results do not contain duplicates", () => {
    const caps = getCapabilitiesForTaskType("feature");
    const ids = caps.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── getCapabilitiesForAgentType ──────────────────────────────────────────────

describe("getCapabilitiesForAgentType", () => {
  it("returns roles compatible with claude_code", () => {
    const caps = getCapabilitiesForAgentType("claude_code");
    // All 14 roles support claude_code
    expect(caps.length).toBe(14);
  });

  it("returns only roles that include the given agent type", () => {
    const caps = getCapabilitiesForAgentType("codex");
    for (const cap of caps) {
      expect(cap.supportedAgentTypes).toContain("codex");
    }
  });

  it("codex is not listed for human-only-oriented roles like cto", () => {
    const ctoCap = getCapability("cto");
    expect(ctoCap?.supportedAgentTypes).not.toContain("codex");
  });

  it("frontend_engineer supports codex", () => {
    const caps = getCapabilitiesForAgentType("codex");
    const ids = caps.map((c) => c.id);
    expect(ids).toContain("frontend_engineer");
  });

  it("backend_engineer supports codex", () => {
    const caps = getCapabilitiesForAgentType("codex");
    const ids = caps.map((c) => c.id);
    expect(ids).toContain("backend_engineer");
  });

  it("human agent type returns roles that explicitly support human workers", () => {
    const caps = getCapabilitiesForAgentType("human");
    expect(caps.length).toBeGreaterThan(0);
    for (const cap of caps) {
      expect(cap.supportedAgentTypes).toContain("human");
    }
  });

  it("reviewer supports all three agent types", () => {
    const cap = getCapability("reviewer");
    expect(cap?.supportedAgentTypes).toContain("claude_code");
    expect(cap?.supportedAgentTypes).toContain("codex");
    expect(cap?.supportedAgentTypes).toContain("human");
  });

  it("results do not contain duplicates", () => {
    const caps = getCapabilitiesForAgentType("claude_code");
    const ids = caps.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── canRoleHandleTask ────────────────────────────────────────────────────────

describe("canRoleHandleTask", () => {
  it("returns true when the role lists the task type", () => {
    expect(canRoleHandleTask("frontend_engineer", "feature")).toBe(true);
  });

  it("returns false when the role does not list the task type", () => {
    expect(canRoleHandleTask("frontend_engineer", "incident_investigation")).toBe(false);
  });

  it("returns false for an unknown role slug", () => {
    expect(canRoleHandleTask("unknown_role", "feature")).toBe(false);
  });

  it("returns false for an unknown task type on a valid role", () => {
    expect(canRoleHandleTask("backend_engineer", "alien_task")).toBe(false);
  });

  it("returns false for both unknown role and unknown task type", () => {
    expect(canRoleHandleTask("ghost", "phantom")).toBe(false);
  });

  it("backend_engineer can handle database_migration", () => {
    expect(canRoleHandleTask("backend_engineer", "database_migration")).toBe(true);
  });

  it("security_engineer can handle vulnerability_assessment", () => {
    expect(canRoleHandleTask("security_engineer", "vulnerability_assessment")).toBe(true);
  });

  it("qa_engineer can handle acceptance_testing", () => {
    expect(canRoleHandleTask("qa_engineer", "acceptance_testing")).toBe(true);
  });

  it("devops_engineer can handle ci_cd_setup", () => {
    expect(canRoleHandleTask("devops_engineer", "ci_cd_setup")).toBe(true);
  });

  it("release_manager can handle deployment", () => {
    expect(canRoleHandleTask("release_manager", "deployment")).toBe(true);
  });

  it("monitoring_engineer can handle incident_investigation", () => {
    expect(canRoleHandleTask("monitoring_engineer", "incident_investigation")).toBe(true);
  });

  it("technical_writer can handle api_documentation", () => {
    expect(canRoleHandleTask("technical_writer", "api_documentation")).toBe(true);
  });

  it("product_manager cannot handle code_review", () => {
    expect(canRoleHandleTask("product_manager", "code_review")).toBe(false);
  });

  it("cto can handle technical_strategy", () => {
    expect(canRoleHandleTask("cto", "technical_strategy")).toBe(true);
  });

  it("ai_engineer can handle prompt_engineering", () => {
    expect(canRoleHandleTask("ai_engineer", "prompt_engineering")).toBe(true);
  });
});
