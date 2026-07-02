import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { loadLivePipeline } from "@/lib/live-pipeline-data";
import {
  loadConversationActivity,
  resolveConversationScope,
} from "@/lib/chat-activity-server";
import { ChatSurface } from "./chat-surface";
import type { ChatThreadMessage } from "./chat-thread";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatThreadPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true, name: true },
  });
  if (!company) redirect("/onboarding");

  const conv = await prisma.conversation.findFirst({
    where: { id, companyId: company.id, type: "chat" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          request: {
            select: {
              id: true,
              title: true,
              status: true,
              assignedTo: true,
              requestType: true,
              clarification: true,
            },
          },
        },
      },
    },
  });

  if (!conv) notFound();

  // Scope the company-wide live stream down to this conversation's work, then
  // seed the thread with its authoritative activity history + the current board.
  const scope = await resolveConversationScope(company.id, id);
  const [seedActivity, initialPipeline] = await Promise.all([
    loadConversationActivity(company.id, scope),
    loadLivePipeline(company.id, { userId: user.id }),
  ]);

  const messages: ChatThreadMessage[] = conv.messages.map((m) => ({
    id: m.id,
    role: m.role,
    type: m.type,
    content: m.content,
    createdAt: m.createdAt,
    request: m.request,
  }));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/chat"
          className="flex items-center gap-1.5 text-xs text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Chat
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="truncate text-sm font-medium text-neutral-300">
          {conv.title ?? "New conversation"}
        </h1>
      </header>

      {/* Live thread + composer (optimistic send) */}
      <ChatSurface
        conversationId={id}
        messages={messages}
        seedActivity={seedActivity}
        initialPipeline={initialPipeline}
        scope={scope}
      />
    </div>
  );
}
