import { prisma } from "@/lib/prisma";

type NotifyInput = {
  userId: string;
  companyId?: string;
  title: string;
  body?: string;
  type?: "info" | "warning" | "alert" | "decision" | "progress" | "blocker";
  priority?: "low" | "medium" | "high" | "urgent";
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
};

export async function notify(input: NotifyInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      companyId: input.companyId,
      title: input.title,
      body: input.body,
      type: input.type ?? "info",
      priority: input.priority ?? "medium",
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
    },
  });
}

export async function notifyInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: NotifyInput
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      companyId: input.companyId,
      title: input.title,
      body: input.body,
      type: input.type ?? "info",
      priority: input.priority ?? "medium",
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
    },
  });
}
