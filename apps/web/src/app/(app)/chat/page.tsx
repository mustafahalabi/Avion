import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { NewConversationButton } from "./new-conversation-button";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const conversations = await prisma.conversation.findMany({
    where: { companyId: company.id, type: "chat" },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Chat</h1>
        <NewConversationButton />
      </header>

      <div className="flex flex-col gap-1 p-4">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-neutral-800 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800">
              <MessageSquare className="h-5 w-5 text-neutral-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-300">
                No conversations yet
              </p>
              <p className="mt-1 text-xs text-neutral-600 max-w-xs">
                Start a conversation to communicate goals, ask questions, or
                direct your company.
              </p>
            </div>
            <NewConversationButton variant="primary" />
          </div>
        ) : (
          conversations.map((conv) => {
            const lastMsg = conv.messages[0];
            const preview = lastMsg
              ? lastMsg.content.replace(/\*\*/g, "").slice(0, 100)
              : "No messages yet";
            const title = conv.title ?? "New conversation";

            return (
              <Link
                key={conv.id}
                href={`/chat/${conv.id}`}
                className="group flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3.5 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5 text-neutral-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-200 truncate">
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-600 truncate">
                    {lastMsg?.role === "company" ? "Company: " : ""}
                    {preview}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                  <span className="text-[10px] text-neutral-700">
                    {new Date(conv.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
