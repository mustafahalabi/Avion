import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Resolves the local User for the authenticated Clerk session.
 *
 * `auth()` verifies the session locally (from the request JWT) — cheap and
 * reliable. `currentUser()`, by contrast, calls Clerk's BACKEND API and so is
 * both slower and occasionally throws a transient `ClerkAPIResponseError` (rate
 * limits / backend blips). Because this runs on essentially every page and
 * server action, letting that call fail here would break the whole app.
 *
 * So we only hit Clerk's backend when we genuinely need the profile: the first
 * time we see a user (to seed the local record). For every subsequent request we
 * return the cached local User with no backend call — faster, and immune to
 * Clerk API hiccups. A transient failure on the first-ever request resolves to
 * `null` (treated as unauthenticated for that request); the next one succeeds.
 */
export async function getCurrentUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  // Fast path: existing user — no Clerk backend call.
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  // First sight of this user — fetch their profile to seed the local record.
  let clerkUser: Awaited<ReturnType<typeof currentUser>>;
  try {
    clerkUser = await currentUser();
  } catch {
    // Clerk backend momentarily unavailable — don't crash; a later request retries.
    return null;
  }
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name =
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() || null;
  const image = clerkUser.imageUrl ?? null;

  return prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email, name, image },
    update: { email, name, image },
  });
}
