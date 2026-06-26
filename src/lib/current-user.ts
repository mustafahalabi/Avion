import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";
  const name =
    clerkUser
      ? `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null
      : null;
  const image = clerkUser?.imageUrl ?? null;

  return prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email, name, image },
    update: { email, name, image },
  });
}
