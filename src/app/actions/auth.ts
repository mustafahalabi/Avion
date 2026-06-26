"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";

const registerSchema = z.object({
  name: z.string().min(2).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(8),
});

export type RegisterState =
  | { errors?: { name?: string[]; email?: string[]; password?: string[] }; message?: string }
  | undefined;

export async function registerUser(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { message: "An account with this email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  const uniqueSlug = `${slug}-${Date.now().toString(36)}`;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash },
    });

    const company = await tx.company.create({
      data: {
        name: `${name}'s Company`,
        slug: uniqueSlug,
        ownerId: user.id,
        settings: {
          create: {
            autonomyLevel: "assist",
            cultureProfile: "startup",
          },
        },
        workspaces: {
          create: {
            name: "Main Workspace",
            slug: "main",
          },
        },
      },
    });

    return { user, company };
  });

  await signIn("credentials", {
    email,
    password,
    redirectTo: "/onboarding",
  });
}
