import type { OutcomePlanningInput } from "@/lib/planning-generator";
import type { PlanEvalCase } from "@/lib/planning/plan-eval";

/**
 * A small, realistic company roster reused across eval fixtures so that role
 * recommendations resolve to real employee ids (and `noHallucinatedEmployees` is meaningful).
 */
const ROSTER: OutcomePlanningInput["employees"] = [
  {
    id: "employee-product-manager",
    name: "Priya Patel",
    title: null,
    roleName: "Product Manager",
    responsibilities: "Own outcomes, scope, and acceptance criteria.",
  },
  {
    id: "employee-tech-lead",
    name: "Tomas Lindgren",
    title: null,
    roleName: "Tech Lead",
    responsibilities: "Decompose work and own technical design.",
  },
  {
    id: "employee-backend",
    name: "Bianca Rossi",
    title: null,
    roleName: "Backend Engineer",
    responsibilities: "Build server actions, APIs, and data models.",
  },
  {
    id: "employee-frontend",
    name: "Frank Owusu",
    title: null,
    roleName: "Frontend Engineer",
    responsibilities: "Build user interfaces and client-side states.",
  },
  {
    id: "employee-reviewer",
    name: "Rebecca Stone",
    title: null,
    roleName: "Reviewer",
    responsibilities: "Review correctness, ownership, and risk.",
  },
  {
    id: "employee-qa",
    name: "Quentin Adeyemi",
    title: null,
    roleName: "QA Engineer",
    responsibilities: "Write and execute QA plans.",
  },
];

/**
 * A connected Next.js / TypeScript repository with concrete important files, used to
 * exercise framework and important-file grounding checks.
 */
const NEXTJS_REPOSITORY: OutcomePlanningInput["repositories"] = [
  {
    id: "repo-engineering-os",
    name: "engineering-os",
    description: "Engineering OS platform",
    primaryLanguage: "TypeScript",
    techStack: ["Prisma", "SQLite"],
    frameworks: ["Next.js App Router"],
    dependencies: ["@prisma/client", "zod"],
    importantFiles: ["prisma/schema.prisma", "src/app/actions/runtime.ts"],
    analysisStatus: "analyzed",
    analysisNotes: "Repository metadata is current.",
    latestChangeSummary: null,
    latestChangeImpactLevel: null,
    latestChangeAffectedAreas: [],
    latestChangeRecommendedActions: [],
  },
];

/**
 * Declarative planning-eval fixtures shared by the harness and the unit test.
 *
 * - `repository-intelligence` exercises the repository-aware template, so framework and
 *   important-file grounding apply.
 * - `general-product-outcome` exercises the general template with a roster but no
 *   repository-specific grounding requirement.
 */
export const PLANNING_EVAL_CASES: readonly PlanEvalCase[] = [
  {
    name: "repository-intelligence",
    input: {
      companyId: "company-eval",
      outcomeId: "outcome-repo-intel",
      title: "Build Repository Intelligence V2",
      rawRequest: "Build repository intelligence that analyzes the codebase and manifests.",
      brief: "Give planning a durable, evidence-backed understanding of each repository.",
      businessValue: "Faster, safer planning grounded in real repository facts.",
      successCriteria: [
        "Repository source tree, manifests, framework, and database layer are detected.",
        "Findings are exposed in a reviewable intelligence summary.",
      ],
      constraints: ["Repository analysis must stay read-only and deterministic."],
      employees: ROSTER,
      repositories: NEXTJS_REPOSITORY,
    },
    expect: {
      framework: "Next.js",
      mustReferenceImportantFile: true,
      minTasks: 5,
    },
  },
  {
    name: "general-product-outcome",
    input: {
      companyId: "company-eval",
      outcomeId: "outcome-billing",
      title: "Add subscription billing and checkout",
      rawRequest: "Add subscription billing with a checkout flow and customer-facing plan management.",
      brief: "Let customers self-serve subscriptions end to end.",
      businessValue: "Recurring revenue without manual billing operations.",
      successCriteria: [
        "Customers can subscribe, change plans, and cancel.",
        "Billing state stays consistent with the payment provider.",
      ],
      constraints: ["Preserve company ownership boundaries on all new data."],
      employees: ROSTER,
      repositories: NEXTJS_REPOSITORY,
    },
    expect: {
      minTasks: 5,
    },
  },
];
