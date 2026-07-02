import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Building2, CheckCircle2, AlertCircle, Clock, Circle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChatInput } from "./chat-input";
import { ChatScrollAnchor } from "./chat-scroll-anchor";

interface Props {
  params: Promise<{ id: string }>;
}

const REQUEST_STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  intake: { label: "Intake", color: "text-blue-400", icon: Circle },
  planning: { label: "Planning", color: "text-neutral-400", icon: Clock },
  awaiting_approval: { label: "Awaiting Approval", color: "text-amber-400", icon: AlertCircle },
  executing: { label: "Executing", color: "text-emerald-400", icon: Clock },
  in_review: { label: "In Review", color: "text-amber-400", icon: Clock },
  in_qa: { label: "In QA", color: "text-neutral-400", icon: Clock },
  complete: { label: "Complete", color: "text-emerald-400", icon: CheckCircle2 },
  blocked: { label: "Blocked", color: "text-red-400", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-neutral-500", icon: Circle },
};

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

  const isEmpty = conv.messages.length === 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/chat"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Chat
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-medium text-neutral-300 truncate">
          {conv.title ?? "New conversation"}
        </h1>
      </header>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isEmpty ? (
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 pt-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800">
              <Building2 className="h-5 w-5 text-neutral-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-300">
                Talk to your company
              </p>
              <p className="mt-1 text-xs text-neutral-600 max-w-sm">
                State a goal, ask a question, or give a direction. The company
                will receive your message and route it to the right team.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
            {conv.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    msg.role === "user"
                      ? "bg-white text-neutral-900"
                      : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                  )}
                >
                  {msg.role === "user" ? "C" : "E"}
                </div>

                <div
                  className={cn(
                    "flex flex-col gap-1.5",
                    msg.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  {/* Bubble */}
                  <div
                    className={cn(
                      "max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-neutral-100 text-neutral-900 rounded-tr-sm"
                        : "bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-tl-sm"
                    )}
                  >
                    {renderContent(msg.content)}
                  </div>

                  {/* Linked request card */}
                  {msg.request && (
                    <RequestCard request={msg.request} />
                  )}

                  <span className="text-[10px] text-neutral-700 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            <ChatScrollAnchor count={conv.messages.length} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-neutral-800 px-6 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <ChatInput conversationId={id} />
        </div>
      </div>
    </div>
  );
}

function renderContent(content: string) {
  // Simple **bold** rendering without a markdown library
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function RequestCard({
  request,
}: {
  request: {
    id: string;
    title: string;
    status: string;
    assignedTo: string | null;
    requestType: string;
    clarification: string | null;
  };
}) {
  const cfg = REQUEST_STATUS_LABEL[request.status] ?? REQUEST_STATUS_LABEL["intake"];
  const Icon = cfg.icon;

  return (
    <Link
      href={`/inbox/requests/${request.id}`}
      className="group flex items-start gap-2.5 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 max-w-xs transition-colors hover:border-neutral-700"
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", cfg.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-neutral-300 truncate">
          {request.title}
        </p>
        <p className={cn("mt-0.5 text-[11px] font-medium", cfg.color)}>
          {cfg.label}
          {request.assignedTo && (
            <span className="font-normal text-neutral-600">
              {" · "}{request.assignedTo}
            </span>
          )}
        </p>
        {request.clarification && (
          <p className="mt-1 text-[11px] text-amber-600 truncate">
            Needs clarification
          </p>
        )}
      </div>
      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
    </Link>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
