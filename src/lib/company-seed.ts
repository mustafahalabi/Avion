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
  },
  {
    name: "Product Manager",
    roleName: "Product Manager",
    departmentSlug: "product",
    reportsTo: "CTO",
    mission:
      "Transform business objectives into executable engineering work and keep the product roadmap aligned with company goals.",
  },
  {
    name: "Technical Writer",
    roleName: "Technical Writer",
    departmentSlug: "product",
    reportsTo: "Product Manager",
    mission:
      "Ensure all company knowledge is captured, accurate, and accessible to every employee.",
  },
  {
    name: "Tech Lead",
    roleName: "Tech Lead",
    departmentSlug: "engineering",
    reportsTo: "CTO",
    mission:
      "Break approved work into tasks, assign them to the right engineers, and drive them to done at high quality.",
  },
  {
    name: "Frontend Engineer",
    roleName: "Frontend Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Build user interfaces and client-side systems that meet the product specification and quality standards.",
  },
  {
    name: "Backend Engineer",
    roleName: "Backend Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Design and implement the server-side systems, APIs, and data models that power the product.",
  },
  {
    name: "AI Engineer",
    roleName: "AI Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Integrate AI capabilities into the product and ensure they operate reliably and safely.",
  },
  {
    name: "Infrastructure Engineer",
    roleName: "Infrastructure Engineer",
    departmentSlug: "engineering",
    reportsTo: "Tech Lead",
    mission:
      "Design and maintain the infrastructure that supports reliable, scalable, and secure system operation.",
  },
  {
    name: "Reviewer",
    roleName: "Reviewer",
    departmentSlug: "quality",
    reportsTo: "Tech Lead",
    mission:
      "Ensure every code change is correct, complete, safe, and consistent with company standards before it reaches QA.",
  },
  {
    name: "QA Engineer",
    roleName: "QA Engineer",
    departmentSlug: "quality",
    reportsTo: "Tech Lead",
    mission:
      "Validate that every deliverable works correctly, is free of regressions, and meets acceptance criteria.",
  },
  {
    name: "Security Engineer",
    roleName: "Security Engineer",
    departmentSlug: "quality",
    reportsTo: "CTO",
    mission:
      "Protect the company, its systems, and its users from security risks across the entire engineering lifecycle.",
  },
  {
    name: "DevOps Engineer",
    roleName: "DevOps Engineer",
    departmentSlug: "operations",
    reportsTo: "CTO",
    mission:
      "Own the deployment pipeline, CI/CD infrastructure, and the operational tooling that keeps the system running.",
  },
  {
    name: "Release Manager",
    roleName: "Release Manager",
    departmentSlug: "operations",
    reportsTo: "CTO",
    mission:
      "Own the release process and ensure every deployment is coordinated, verified, and safe.",
  },
  {
    name: "Monitoring Engineer",
    roleName: "Monitoring Engineer",
    departmentSlug: "operations",
    reportsTo: "Release Manager",
    mission:
      "Maintain complete operational visibility and trigger response when system health degrades.",
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
      reportsTo: e.reportsTo,
      departmentId: deptBySlug[e.departmentSlug],
      roleId: roleByName[e.roleName],
      status: "active",
    })),
  });

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
      },
    });
  }
}
