import type { FollowUpReplyContext } from "@/lib/chat-followup-service";

import type { ChatReplyInput } from "./chat-reply-adapter";

/**
 * Builds the grounded prompt for an AI chat reply.
 *
 * The system prompt fixes the chief-of-staff role and a hard grounding contract:
 * answer ONLY from the provided facts, never invent a status / number / PR, and
 * never claim work shipped unless the facts say so. The user prompt carries a
 * compact facts block (the same real rows the deterministic reply uses) plus the
 * CEO's message. No repository contents, no history beyond these facts — so the
 * model has nothing to hallucinate from.
 */

const SYSTEM_PROMPT = [
  "You are the chief of staff of a virtual software company, replying to the CEO in a chat thread.",
  "",
  "Rules (hard):",
  "- Answer ONLY using the FACTS provided in the user message. Do not invent statuses, numbers, PRs, branches, dates, or names.",
  "- Never claim work has shipped, merged, deployed, been released, or is complete/approved unless the FACTS explicitly say so.",
  "- If the facts don't answer the CEO's question, say what is and isn't known — do not guess.",
  "- Be a concise, warm chief of staff: 2–5 sentences, plain language, no bullet lists, no markdown headers.",
  "- If the CEO asked a question, answer it from the facts. Otherwise acknowledge their message and give a brief status.",
].join("\n");

/** Renders the plan fact line. */
function planFact(plan: FollowUpReplyContext["plan"]): string {
  if (!plan) return "Plan: not generated yet.";
  return `Plan: v${plan.version}, status "${plan.status}"${plan.regenerated ? " (just updated with the CEO's note)" : ""}.`;
}

/** Builds the grounded {system, prompt} pair for an AI chat reply. */
export function buildChatReplyPrompt(input: ChatReplyInput): {
  system: string;
  prompt: string;
} {
  const { context, message } = input;
  const counts = context.taskCounts;

  const facts: string[] = [
    `Request: "${context.requestTitle}", status "${context.requestStatus}".`,
    planFact(context.plan),
    `Delivery tasks: ${counts.total} total — ${counts.todo} todo, ${counts.inProgress} in progress, ${counts.inReview} in review, ${counts.done} done${counts.other > 0 ? `, ${counts.other} other` : ""}.`,
  ];

  if (context.openCeoQuestions.length > 0) {
    facts.push(
      `Open questions the company is waiting on: ${context.openCeoQuestions
        .map((q, i) => `(${i + 1}) ${q}`)
        .join(" ")}`
    );
  }

  const openChangeRequests = context.openChangeRequests ?? 0;
  if (openChangeRequests > 0) {
    facts.push(
      `Pending rework: ${openChangeRequests} unresolved change request(s); the CEO's message is being attached to steer the rework loop.`
    );
  }

  const prompt = [
    "FACTS (the only things you may state):",
    ...facts.map((f) => `- ${f}`),
    "",
    `CEO's message: "${message.trim()}"`,
    "",
    "Reply as the chief of staff, grounded only in the FACTS above.",
  ].join("\n");

  return { system: SYSTEM_PROMPT, prompt };
}
