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
import { summarizeOutcomeUsageMany } from "@/lib/agent-usage-service";
import { resolveSpendCeilingUsd } from "@/lib/spend-ceiling";
import { ChatSurface } from "./chat-surface";
import { OutcomeSpendChip } from "./outcome-spend-chip";
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
  const [seedActivity, initialPipeline, usageMap, settings] = await Promise.all([
    loadConversationActivity(company.id, scope),
    loadLivePipeline(company.id, { userId: user.id }),
    summarizeOutcomeUsageMany(company.id, scope.outcomeIds),
    prisma.companySettings.findUnique({
      where: { companyId: company.id },
      select: { spendCeilingUsd: true },
    }),
  ]);

  // Per-outcome spend meter (Goal 3): real dollars this conversation has spent,
  // against the effective ceiling. Server-rendered; refreshes as work advances.
  const outcomeCosts = [...usageMap.values()].map((u) => u.costUsd);
  const totalSpendUsd = outcomeCosts.reduce((s, c) => s + c, 0);
  // The ceiling is PER-OUTCOME, so the over-budget tone is driven by the most
  // expensive single outcome, not the cross-outcome sum.
  const maxOutcomeSpendUsd = outcomeCosts.length > 0 ? Math.max(...outcomeCosts) : 0;
  const ceilingUsd = resolveSpendCeilingUsd(settings?.spendCeilingUsd ?? null);

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
        <div className="ml-auto">
          <OutcomeSpendChip
            spentUsd={totalSpendUsd}
            ceilingUsd={ceilingUsd}
            ratioBasisUsd={maxOutcomeSpendUsd}
          />
        </div>
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
