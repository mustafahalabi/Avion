"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { read: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
}

export async function markAllRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true, readAt: new Date() },
  });

  revalidatePath("/notifications");
}
