import { PrismaClient } from "@/generated/prisma/client";

const V1_DEPARTMENTS = [
  {
    name: "Executive",
    slug: "executive",
    description: "Provides long-term direction for the company and protects organizational health.",
  },
  {
    name: "Product",
    slug: "product",
    description: "Transforms business objectives into executable engineering work.",
  },
  {
    name: "Engineering",
    slug: "engineering",
    description: "Designs, implements, and maintains software systems that satisfy company objectives.",
  },
  {
    name: "Quality",
    slug: "quality",
    description: "Ensures every deliverable meets the company's quality standards before release.",
  },
  {
    name: "Operations",
    slug: "operations",
    description: "Owns the deployment, reliability, and operational health of production systems.",
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

export async function seedCompanyStructure(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  companyId: string
) {
  await tx.department.createMany({
    data: V1_DEPARTMENTS.map((d) => ({ ...d, companyId })),
  });

  const existingRoles = await tx.role.count();
  if (existingRoles === 0) {
    await tx.role.createMany({
      data: V1_ROLES.map((r) => ({ ...r })),
    });
  }
}
