"use server";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

const REQUEST_ROUTING: Record<string, string> = {
  feature: "Product Manager",
  bug: "Tech Lead",
  architecture: "CTO",
  security: "Security Lead",
  documentation: "Technical Writer",
  configuration: "DevOps Lead",
  performance: "Tech Lead",
  question: "Company",
};

export type SendMessageState =
  | undefined
  | { error: string }
  | { conversationId: string };

export async function createConversation(): Promise<{ id: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const conv = await prisma.conversation.create({
    data: {
      companyId: company.id,
      type: "chat",
    },
    select: { id: true },
  });

  return conv;
}

const sendSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000),
  requestType: z.string().default("feature"),
});

export async function sendMessage(
  conversationId: string,
  _prev: SendMessageState,
  formData: FormData
): Promise<SendMessageState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true, name: true },
  });
  if (!company) return { error: "Company not found." };

  const parsed = sendSchema.safeParse({
    content: formData.get("content"),
    requestType: formData.get("requestType") ?? "feature",
  });
  if (!parsed.success) {
    const issues = parsed.error.issues;
    return { error: issues[0]?.message ?? "Invalid input." };
  }

  const { content, requestType } = parsed.data;

  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId: company.id },
    include: { _count: { select: { messages: true } } },
  });
  if (!conv) return { error: "Conversation not found." };

  const isFirstMessage = conv._count.messages === 0;

  await prisma.$transaction(async (tx) => {
    // User message
    await tx.message.create({
      data: {
        conversationId,
        authorId: user.id,
        role: "user",
        type: "text",
        content,
      },
    });

    // On first message, auto-create a RuntimeRequest and set conversation title
    if (isFirstMessage) {
      // Derive a short title from the content
      const title = content.length > 80 ? content.slice(0, 77) + "…" : content;
      const assignedTo = REQUEST_ROUTING[requestType] ?? "Company";

      const request = await tx.runtimeRequest.create({
        data: {
          companyId: company.id,
          title,
          goal: content,
          requestType,
          status: "intake",
          assignedTo,
        },
      });

      // Set conversation title to the request title
      await tx.conversation.update({
        where: { id: conversationId },
        data: { title, updatedAt: new Date() },
      });

      // Company response message
      await tx.message.create({
        data: {
          conversationId,
          role: "company",
          type: "request_created",
          requestId: request.id,
          content: `Your request has been received and routed to **${assignedTo}**. The team is now reviewing your goal and will begin planning.`,
        },
      });

      // Log intake event on the request
      await tx.runtimeEvent.create({
        data: {
          requestId: request.id,
          type: "intake",
          description: `Request received via company chat. Routed to ${assignedTo}.`,
          actor: "System",
        },
      });
    } else {
      // Update conversation timestamp
      await tx.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      // Acknowledge follow-up
      await tx.message.create({
        data: {
          conversationId,
          role: "company",
          type: "text",
          content: `Message noted. The team will factor this into ongoing work. Check the **Inbox** to track or advance any active requests.`,
        },
      });
    }
  });

  revalidatePath(`/chat/${conversationId}`);
  revalidatePath("/chat");
  revalidatePath("/inbox");
  revalidatePath("/dashboard");

  return { conversationId };
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) return;

  await prisma.conversation.deleteMany({
    where: { id: conversationId, companyId: company.id },
  });

  revalidatePath("/chat");
  redirect("/chat");
}
