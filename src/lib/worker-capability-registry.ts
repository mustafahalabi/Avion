import type { ExecutionSessionAgentType } from "@/lib/execution-session-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkerCapability {
  /** Stable slug — matches the registry key */
  id: string;
  /** Human-readable display name */
  name: string;
  /** One-sentence summary of what this role does */
  description: string;
  /** Task types this role can handle */
  taskTypes: string[];
  /** Agent execution backends compatible with this role */
  supportedAgentTypes: ExecutionSessionAgentType[];
  /** Maximum number of concurrent tasks this role can own */
  maxConcurrentTasks: number;
  /** Rough wall-clock estimate for a single task */
  estimatedTaskDurationMinutes: { min: number; max: number };
  /** Context the role must receive before starting a task */
  requiredContext: string[];
  /** Artifacts the role produces when a task is complete */
  producedOutputs: string[];
  /** Whether this role is permitted to self-review its own work */
  canReviewOwnWork: boolean;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * Canonical registry of every worker role in the Avion organisation.
 * Keyed by role slug (snake_case).
 */
export const WORKER_CAPABILITY_REGISTRY: Record<string, WorkerCapability> = {
  cto: {
    id: "cto",
    name: "CTO",
    description:
      "Sets technical direction, owns architecture decisions, and ensures engineering quality across the company.",
    taskTypes: [
      "architecture_review",
      "technical_strategy",
      "engineering_process",
      "incident_management",
      "team_coordination",
      "technical_decision",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 3,
    estimatedTaskDurationMinutes: { min: 60, max: 480 },
    requiredContext: [
      "company_context",
      "repository",
      "engineering_standards",
      "team_composition",
    ],
    producedOutputs: [
      "architecture_decision_record",
      "technical_strategy_doc",
      "engineering_standards_update",
      "incident_report",
    ],
    canReviewOwnWork: false,
  },

  product_manager: {
    id: "product_manager",
    name: "Product Manager",
    description:
      "Translates CEO outcomes into structured roadmaps, writes PRDs, and prioritises engineering work.",
    taskTypes: [
      "requirements_definition",
      "roadmap_planning",
      "feature_scoping",
      "stakeholder_alignment",
      "acceptance_criteria",
      "backlog_grooming",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 5,
    estimatedTaskDurationMinutes: { min: 30, max: 180 },
    requiredContext: [
      "company_context",
      "business_goals",
      "existing_features",
      "user_feedback",
    ],
    producedOutputs: [
      "product_requirements_doc",
      "feature_brief",
      "roadmap",
      "acceptance_criteria",
      "user_story",
    ],
    canReviewOwnWork: false,
  },

  tech_lead: {
    id: "tech_lead",
    name: "Tech Lead",
    description:
      "Decomposes features into implementable tasks, sets technical standards for a squad, and unblocks engineers.",
    taskTypes: [
      "task_breakdown",
      "technical_planning",
      "code_review",
      "architecture_review",
      "mentoring",
      "feature",
      "refactor",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 4,
    estimatedTaskDurationMinutes: { min: 30, max: 240 },
    requiredContext: [
      "repository",
      "codebase_summary",
      "task_brief",
      "engineering_standards",
    ],
    producedOutputs: [
      "task_list",
      "technical_plan",
      "code_review_feedback",
      "architecture_notes",
    ],
    canReviewOwnWork: false,
  },

  frontend_engineer: {
    id: "frontend_engineer",
    name: "Frontend Engineer",
    description:
      "Builds user-facing UI components, pages, and client-side logic using the project's frontend stack.",
    taskTypes: [
      "feature",
      "bug_fix",
      "refactor",
      "ui_component",
      "accessibility",
      "performance_optimisation",
      "animation",
    ],
    supportedAgentTypes: ["claude_code", "codex"],
    maxConcurrentTasks: 3,
    estimatedTaskDurationMinutes: { min: 20, max: 180 },
    requiredContext: [
      "repository",
      "task_brief",
      "codebase_summary",
      "design_specs",
      "component_library",
    ],
    producedOutputs: [
      "code_changes",
      "pr",
      "component",
      "storybook_stories",
      "accessibility_report",
    ],
    canReviewOwnWork: false,
  },

  backend_engineer: {
    id: "backend_engineer",
    name: "Backend Engineer",
    description:
      "Implements APIs, services, and database logic that power the application's server-side behaviour.",
    taskTypes: [
      "feature",
      "bug_fix",
      "refactor",
      "api_design",
      "database_migration",
      "performance_optimisation",
      "integration",
    ],
    supportedAgentTypes: ["claude_code", "codex"],
    maxConcurrentTasks: 3,
    estimatedTaskDurationMinutes: { min: 30, max: 240 },
    requiredContext: [
      "repository",
      "task_brief",
      "codebase_summary",
      "database_schema",
      "api_contracts",
    ],
    producedOutputs: [
      "code_changes",
      "pr",
      "migration_files",
      "api_documentation",
      "test_results",
    ],
    canReviewOwnWork: false,
  },

  ai_engineer: {
    id: "ai_engineer",
    name: "AI Engineer",
    description:
      "Integrates LLMs, builds AI-powered features, designs prompts, and maintains model pipelines.",
    taskTypes: [
      "feature",
      "bug_fix",
      "refactor",
      "llm_integration",
      "prompt_engineering",
      "ai_pipeline",
      "model_evaluation",
    ],
    supportedAgentTypes: ["claude_code", "codex"],
    maxConcurrentTasks: 2,
    estimatedTaskDurationMinutes: { min: 45, max: 360 },
    requiredContext: [
      "repository",
      "task_brief",
      "codebase_summary",
      "model_specifications",
      "evaluation_criteria",
    ],
    producedOutputs: [
      "code_changes",
      "pr",
      "prompt_templates",
      "evaluation_results",
      "ai_pipeline_docs",
    ],
    canReviewOwnWork: false,
  },

  infrastructure_engineer: {
    id: "infrastructure_engineer",
    name: "Infrastructure Engineer",
    description:
      "Designs and maintains cloud infrastructure, networking, and platform reliability.",
    taskTypes: [
      "infrastructure_change",
      "capacity_planning",
      "security_hardening",
      "cost_optimisation",
      "disaster_recovery",
      "feature",
      "bug_fix",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 2,
    estimatedTaskDurationMinutes: { min: 60, max: 480 },
    requiredContext: [
      "repository",
      "task_brief",
      "infrastructure_topology",
      "cloud_provider_config",
      "cost_targets",
    ],
    producedOutputs: [
      "infrastructure_as_code",
      "pr",
      "runbook",
      "architecture_diagram",
      "cost_report",
    ],
    canReviewOwnWork: false,
  },

  reviewer: {
    id: "reviewer",
    name: "Reviewer",
    description:
      "Performs thorough code reviews focused on correctness, maintainability, and adherence to engineering standards.",
    taskTypes: [
      "code_review",
      "architecture_review",
      "security_review",
      "pr_review",
    ],
    supportedAgentTypes: ["claude_code", "codex", "human"],
    maxConcurrentTasks: 5,
    estimatedTaskDurationMinutes: { min: 15, max: 120 },
    requiredContext: [
      "repository",
      "pr_diff",
      "task_brief",
      "engineering_standards",
      "codebase_summary",
    ],
    producedOutputs: [
      "review_comments",
      "approval_decision",
      "change_requests",
      "review_summary",
    ],
    canReviewOwnWork: false,
  },

  qa_engineer: {
    id: "qa_engineer",
    name: "QA Engineer",
    description:
      "Validates that features work correctly, writes test plans, and catches regressions before release.",
    taskTypes: [
      "test_plan",
      "manual_testing",
      "automated_testing",
      "regression_testing",
      "bug_report",
      "acceptance_testing",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 4,
    estimatedTaskDurationMinutes: { min: 20, max: 180 },
    requiredContext: [
      "repository",
      "task_brief",
      "acceptance_criteria",
      "test_environment",
      "prior_bug_history",
    ],
    producedOutputs: [
      "test_plan",
      "test_results",
      "bug_report",
      "test_suite",
      "qa_sign_off",
    ],
    canReviewOwnWork: false,
  },

  security_engineer: {
    id: "security_engineer",
    name: "Security Engineer",
    description:
      "Identifies security vulnerabilities, performs threat modelling, and enforces secure coding practices.",
    taskTypes: [
      "security_review",
      "vulnerability_assessment",
      "threat_modelling",
      "penetration_testing",
      "security_hardening",
      "compliance_check",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 3,
    estimatedTaskDurationMinutes: { min: 30, max: 360 },
    requiredContext: [
      "repository",
      "task_brief",
      "codebase_summary",
      "threat_model",
      "compliance_requirements",
    ],
    producedOutputs: [
      "security_report",
      "vulnerability_list",
      "remediation_plan",
      "threat_model_doc",
      "compliance_report",
    ],
    canReviewOwnWork: false,
  },

  devops_engineer: {
    id: "devops_engineer",
    name: "DevOps Engineer",
    description:
      "Builds and maintains CI/CD pipelines, automates deployments, and manages the developer toolchain.",
    taskTypes: [
      "ci_cd_setup",
      "pipeline_optimisation",
      "deployment_automation",
      "toolchain_setup",
      "environment_provisioning",
      "feature",
      "bug_fix",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 3,
    estimatedTaskDurationMinutes: { min: 30, max: 240 },
    requiredContext: [
      "repository",
      "task_brief",
      "infrastructure_topology",
      "deployment_targets",
      "current_pipeline_config",
    ],
    producedOutputs: [
      "pipeline_config",
      "pr",
      "deployment_scripts",
      "runbook",
      "environment_docs",
    ],
    canReviewOwnWork: false,
  },

  release_manager: {
    id: "release_manager",
    name: "Release Manager",
    description:
      "Coordinates releases, manages version bumps, writes changelogs, and ensures safe production deployments.",
    taskTypes: [
      "release_coordination",
      "changelog_generation",
      "version_bump",
      "deployment",
      "rollback",
      "release_notes",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 2,
    estimatedTaskDurationMinutes: { min: 15, max: 120 },
    requiredContext: [
      "repository",
      "task_brief",
      "merged_pr_list",
      "deployment_targets",
      "release_checklist",
    ],
    producedOutputs: [
      "changelog",
      "release_notes",
      "deployment_record",
      "version_tag",
      "rollback_plan",
    ],
    canReviewOwnWork: true,
  },

  monitoring_engineer: {
    id: "monitoring_engineer",
    name: "Monitoring Engineer",
    description:
      "Sets up observability tooling, defines SLOs, and investigates production incidents.",
    taskTypes: [
      "observability_setup",
      "alert_configuration",
      "incident_investigation",
      "slo_definition",
      "dashboard_creation",
      "performance_analysis",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 3,
    estimatedTaskDurationMinutes: { min: 20, max: 180 },
    requiredContext: [
      "repository",
      "task_brief",
      "infrastructure_topology",
      "existing_metrics",
      "slo_targets",
    ],
    producedOutputs: [
      "monitoring_config",
      "alert_rules",
      "incident_report",
      "dashboard",
      "slo_documentation",
    ],
    canReviewOwnWork: true,
  },

  technical_writer: {
    id: "technical_writer",
    name: "Technical Writer",
    description:
      "Produces clear, accurate technical documentation for developers, operators, and end-users.",
    taskTypes: [
      "documentation",
      "api_documentation",
      "user_guide",
      "runbook",
      "architecture_docs",
      "changelog_generation",
      "onboarding_guide",
    ],
    supportedAgentTypes: ["claude_code", "human"],
    maxConcurrentTasks: 4,
    estimatedTaskDurationMinutes: { min: 20, max: 180 },
    requiredContext: [
      "repository",
      "task_brief",
      "codebase_summary",
      "existing_docs",
      "target_audience",
    ],
    producedOutputs: [
      "documentation",
      "api_reference",
      "user_guide",
      "runbook",
      "changelog",
    ],
    canReviewOwnWork: true,
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the capability definition for a given role slug, or `null` when the
 * slug is not registered.
 */
export function getCapability(roleSlug: string): WorkerCapability | null {
  return WORKER_CAPABILITY_REGISTRY[roleSlug] ?? null;
}

/**
 * Returns every registered capability that lists the given task type.
 */
export function getCapabilitiesForTaskType(taskType: string): WorkerCapability[] {
  return Object.values(WORKER_CAPABILITY_REGISTRY).filter((cap) =>
    cap.taskTypes.includes(taskType)
  );
}

/**
 * Returns every registered capability that supports the given agent execution
 * backend.
 */
export function getCapabilitiesForAgentType(
  agentType: ExecutionSessionAgentType
): WorkerCapability[] {
  return Object.values(WORKER_CAPABILITY_REGISTRY).filter((cap) =>
    cap.supportedAgentTypes.includes(agentType)
  );
}

/**
 * Returns `true` when the role identified by `roleSlug` can handle the given
 * task type.
 */
export function canRoleHandleTask(roleSlug: string, taskType: string): boolean {
  const capability = getCapability(roleSlug);
  if (!capability) return false;
  return capability.taskTypes.includes(taskType);
}
