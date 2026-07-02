import { PrismaClient } from "@/generated/prisma/client";

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const V1_DEPARTMENTS = [
  {
    name: "Executive",
    slug: "executive",
    description:
      "Provides long-term direction for the company and protects organizational health.",
  },
  {
    name: "Product",
    slug: "product",
    description:
      "Transforms business objectives into executable engineering work.",
  },
  {
    name: "Engineering",
    slug: "engineering",
    description:
      "Designs, implements, and maintains software systems that satisfy company objectives.",
  },
  {
    name: "Quality",
    slug: "quality",
    description:
      "Ensures every deliverable meets the company's quality standards before release.",
  },
  {
    name: "Operations",
    slug: "operations",
    description:
      "Owns the deployment, reliability, and operational health of production systems.",
  },
] as const;

const V1_ROLES = [
  { name: "Chief Technology Officer", level: 10 },
  { name: "Product Manager", level: 7 },
  { name: "Tech Lead", level: 8 },
  { name: "Frontend Engineer", level: 5 },
  { name: "Backend Engineer", level: 5 },
  { name: "AI Engineer", level: 5 },
  { name: "Infrastructure Engineer", level: 5 },
  { name: "Reviewer", level: 6 },
  { name: "QA Engineer", level: 5 },
  { name: "Security Engineer", level: 6 },
  { name: "DevOps Engineer", level: 5 },
  { name: "Release Manager", level: 6 },
  { name: "Monitoring Engineer", level: 5 },
  { name: "Technical Writer", level: 5 },
] as const;

const V1_EMPLOYEES = [
  {
    name: "CTO",
    roleName: "Chief Technology Officer",
    departmentSlug: "executive",
    reportsTo: null,
    mission:
      "Own the technical direction of the company and ensure engineering operates as a coherent, high-quality organization.",
    responsibilities:
      "Set technical strategy. Make final architecture decisions. Unblock the engineering team. Hire and develop senior engineers. Represent engineering to stakeholders.",
  },
  {
    name: "Product Manager",
    roleName: "Product Manager",
    departmentSlug: "product",
    reportsTo: "CTO",
    mission:
      "Transform business objectives into executable engineering work and keep the product roadmap aligned with company goals.",
    responsibilities:
      "Write and maintain product requirements. Prioritize the backlog. Coordinate with engineering on scope. Accept completed features. Communicate roadmap status.",
  },
  {
    name: "Technical Writer",
    roleName: "Technical Writer",
    departmentSlug: "product",
    reportsTo: "Product Manager",
    mission:
      "Ensure all company knowledge is captured, accurate, and accessible to every employee.",
    responsibilities:
      "Document APIs, architecture decisions, and runbooks. Keep the memory system up to date. Review documentation PRs. Write release notes.",
  },
  {
    name: "Tech Lead",
    roleName: "Tech Lead",
    departmentSlug: "engineering",
    reportsTo: "CTO",
    mission:
      "Break approved work into tasks, assign them to the right engineers, and drive them to done at high quality.",
    responsibilities:
      "Decompose features into tasks. Assign and track engineering work. Conduct code reviews. Resolve technical blockers. Report progress to the CTO.",
  },
  {
    name: "Frontend Engineer",
    roleName: "Frontend Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Build user interfaces and client-side systems that meet the product specification and quality standards.",
    responsibilities:
      "Implement UI components and pages. Ensure accessibility and responsive design. Write frontend tests. Fix visual regressions.",
  },
  {
    name: "Backend Engineer",
    roleName: "Backend Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Design and implement the server-side systems, APIs, and data models that power the product.",
    responsibilities:
      "Build and maintain REST/GraphQL APIs. Design database schemas. Write integration tests. Optimize query performance.",
  },
  {
    name: "AI Engineer",
    roleName: "AI Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Integrate AI capabilities into the product and ensure they operate reliably and safely.",
    responsibilities:
      "Integrate LLM and AI APIs. Design prompt strategies. Monitor AI reliability and cost. Implement safety guardrails.",
  },
  {
    name: "Infrastructure Engineer",
    roleName: "Infrastructure Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Design and maintain the infrastructure that supports reliable, scalable, and secure system operation.",
    responsibilities:
      "Manage cloud infrastructure. Implement IaC. Ensure uptime SLAs. Optimize resource costs. Support deployment pipelines.",
  },
  {
    name: "Reviewer",
    roleName: "Reviewer",
    departmentSlug: "quality",
    reportsTo: "Tech Lead",
    mission:
      "Ensure every code change is correct, complete, safe, and consistent with company standards before it reaches QA.",
    responsibilities:
      "Review all PRs. Check correctness, security, and style. Request changes or approve. Enforce coding standards.",
  },
  {
    name: "QA Engineer",
    roleName: "QA Engineer",
    departmentSlug: "quality",
    reportsTo: "Tech Lead",
    mission:
      "Validate that every deliverable works correctly, is free of regressions, and meets acceptance criteria.",
    responsibilities:
      "Write and execute test plans. Identify and report defects. Verify bug fixes. Sign off on release readiness.",
  },
  {
    name: "Security Engineer",
    roleName: "Security Engineer",
    departmentSlug: "quality",
    reportsTo: "CTO",
    mission:
      "Protect the company, its systems, and its users from security risks across the entire engineering lifecycle.",
    responsibilities:
      "Conduct security reviews. Identify vulnerabilities. Define security policies. Respond to incidents. Maintain compliance posture.",
  },
  {
    name: "DevOps Engineer",
    roleName: "DevOps Engineer",
    departmentSlug: "operations",
    reportsTo: "CTO",
    mission:
      "Own the deployment pipeline, CI/CD infrastructure, and the operational tooling that keeps the system running.",
    responsibilities:
      "Build and maintain CI/CD pipelines. Manage deployment environments. Automate operational tasks. Support on-call runbooks.",
  },
  {
    name: "Release Manager",
    roleName: "Release Manager",
    departmentSlug: "operations",
    reportsTo: "CTO",
    mission:
      "Own the release process and ensure every deployment is coordinated, verified, and safe.",
    responsibilities:
      "Coordinate release schedules. Run release readiness reviews. Gate deployments. Communicate release status to stakeholders.",
  },
  {
    name: "Monitoring Engineer",
    roleName: "Monitoring Engineer",
    departmentSlug: "operations",
    reportsTo: "Release Manager",
    mission:
      "Maintain complete operational visibility and trigger response when system health degrades.",
    responsibilities:
      "Configure and maintain monitoring dashboards. Set alerting thresholds. Triage incidents. Produce operational health reports.",
  },
] as const;

export async function seedCompanyStructure(tx: TxClient, companyId: string) {
  await tx.department.createMany({
    data: V1_DEPARTMENTS.map((d) => ({ ...d, companyId })),
  });

  const existingRoles = await tx.role.count();
  if (existingRoles === 0) {
    await tx.role.createMany({
      data: V1_ROLES.map((r) => ({ ...r })),
    });
  }

  const [departments, roles] = await Promise.all([
    tx.department.findMany({ where: { companyId }, select: { id: true, slug: true } }),
    tx.role.findMany({ select: { id: true, name: true } }),
  ]);

  const deptBySlug = Object.fromEntries(departments.map((d) => [d.slug, d.id]));
  const roleByName = Object.fromEntries(roles.map((r) => [r.name, r.id]));

  await tx.employee.createMany({
    data: V1_EMPLOYEES.map((e) => ({
      companyId,
      name: e.name,
      mission: e.mission,
      responsibilities: e.responsibilities,
      reportsTo: e.reportsTo,
      departmentId: deptBySlug[e.departmentSlug],
      roleId: roleByName[e.roleName],
      status: "active",
    })),
  });

  // Wire managerId relations now that all employees exist
  const allEmployees = await tx.employee.findMany({
    where: { companyId },
    select: { id: true, name: true },
  });
  const employeeByName = Object.fromEntries(allEmployees.map((e) => [e.name, e.id]));

  for (const emp of V1_EMPLOYEES) {
    if (emp.reportsTo) {
      const managerId = employeeByName[emp.reportsTo];
      const employeeId = employeeByName[emp.name];
      if (managerId && employeeId) {
        await tx.employee.update({
          where: { id: employeeId },
          data: { managerId },
        });
      }
    }
  }

  const V1_MEMORIES = [
    {
      title: "Company Memory",
      summary: "Strategic context, decisions, and organizational knowledge for this company.",
      category: "company",
    },
    {
      title: "Architecture Memory",
      summary: "Architectural decisions, system design choices, and technical direction.",
      category: "architecture",
    },
    {
      title: "Product Memory",
      summary: "Product decisions, feature context, and roadmap rationale.",
      category: "product",
    },
    {
      title: "Security Memory",
      summary: "Security policies, vulnerability records, and compliance decisions.",
      category: "security",
    },
    {
      title: "Operations Memory",
      summary: "Infrastructure decisions, deployment history, and incident learnings.",
      category: "operations",
    },
  ];

  for (const mem of V1_MEMORIES) {
    await tx.memory.create({
      data: {
        companyId,
        title: mem.title,
        summary: mem.summary,
        category: mem.category,
        ownerType: "company",
        ownerId: companyId,
      },
    });
  }
}
