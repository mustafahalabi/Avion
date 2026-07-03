/**
 * Turns a raw agent stream event into a company-voiced, CEO-friendly line.
 *
 * This is the "altitude" layer: the store keeps the faithful raw output, and
 * this pure, client-safe function decides how it reads in the default humanized
 * feed. The raw `detail` is still available to the opt-in "watch the agent"
 * drawer — this only shapes the friendly one-liner.
 *
 * Dependency-free (no Prisma/Node) so the chat UI can import it directly.
 *
 * NOTE: the exported signature (`humanizeEvent`, `HumanizedEvent`,
 * `HumanizedTone`) is a contract consumed by the chat UI — enrich the mapping,
 * but keep the shape stable.
 */

import type { AgentStreamEvent, AgentStreamEventType } from "./types";

/** Visual tone the UI maps to a colour/style. */
export type HumanizedTone = "status" | "info" | "action" | "result" | "error";

/** A humanized, presentation-ready view of a single stream event. */
export interface HumanizedEvent {
  /** Emoji/icon hint for the bubble. */
  icon: string;
  /** The friendly one-line text shown in the default feed. */
  text: string;
  /** Tone bucket for styling. */
  tone: HumanizedTone;
}

const TONE_BY_TYPE: Record<AgentStreamEventType, HumanizedTone> = {
  status: "status",
  text: "info",
  tool: "action",
  result: "result",
  stderr: "error",
  raw: "info",
};

const ICON_BY_TONE: Record<HumanizedTone, string> = {
  status: "•",
  info: "›",
  action: "→",
  result: "✓",
  error: "!",
};

/** Longest one-liner we show; the raw drawer keeps the full `detail`. */
const MAX_TEXT_LENGTH = 140;

/** A "0 errors / 0 failing" line — a success even though it names failures. */
const CLEAN_RESULT_RE = /\b0\s+(?:errors?|failures?|failing|failed)\b/i;
/** Test/build/compile failure signals — these must never read as success. */
const FAILURE_RE =
  /\b(?:fail(?:ed|ing|s|ure|ures)?|errored|errors?|exception|panic|not ok)\b|✗|✖|✘/i;
/** Test/build success signals. */
const SUCCESS_RE =
  /\b(?:pass(?:ed|ing|es)?|success(?:ful|fully)?|succeeded|compiled|built)\b|✓|✔|\bPASS\b/i;
/** File-mutation verbs the agent (or a tool line) prints. */
const FILE_VERB_RE =
  /\b(edit(?:ed|ing)?|writ(?:e|ing)|wrote|creat(?:e|ed|ing)|updat(?:e|ed|ing)|modif(?:y|ied|ying)|add(?:ed|ing)?|delet(?:e|ed|ing)|remov(?:e|ed|ing))\b/i;
/**
 * A source path (dir segments + extension, or a bare `foo.ts`-style file).
 * Segments allow `()` and `[]` so Next.js route groups (`(auth)`) and dynamic
 * segments (`[id]`) aren't truncated — e.g. `src/app/(auth)/login/page.tsx`.
 */
const PATH_RE =
  /(?:[\w@().\[\]-]+\/)+[\w@().\[\]-]+(?:\.\w+)?|\b[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|css|scss|less|md|mdx|prisma|py|go|rs|java|rb|php|yml|yaml|toml|html|svg|sql|sh|txt)\b/;
/** Running a command / tests / tooling. */
const COMMAND_RE =
  /\brun(?:ning|s)?\b|^\s*\$\s|\b(?:npm|pnpm|yarn|npx|bun|bash|sh|git|node|tsc|vitest|jest|eslint|prettier|make|cargo|pytest|go)\b/i;

/** Trims to a readable length (ellipsis if cut) and never returns empty. */
function trimText(text: string): string {
  const t = text.trim();
  if (t.length === 0) return "(no output)";
  if (t.length <= MAX_TEXT_LENGTH) return t;
  return `${t.slice(0, MAX_TEXT_LENGTH - 1).trimEnd()}…`;
}

/** Builds the presentation record — icon is derived from tone for consistency. */
function present(tone: HumanizedTone, text: string): HumanizedEvent {
  return { icon: ICON_BY_TONE[tone], text: trimText(text), tone };
}

/** Friendly phrasing for lifecycle `status` markers. */
function humanizeStatus(raw: string): string {
  const lower = raw.toLowerCase();
  if (/truncat|output limit|too (?:much|long)/.test(lower)) {
    return "Output truncated — too long to show it all";
  }
  if (/\b(?:start|begin|begun|launch|spawn)/.test(lower)) {
    return "Started working…";
  }
  // Word-start stems (no trailing boundary) so "finished"/"completed"/"ended"
  // all match, not just the bare verb.
  if (/\b(?:finish|complet|done|exit|end)/.test(lower)) {
    return "Finished";
  }
  return raw.trim() || "Working…";
}

/** Normalizes a matched file verb to a friendly past-tense label. */
function normalizeFileVerb(verb: string): string {
  const v = verb.toLowerCase();
  if (v.startsWith("edit")) return "Edited";
  if (v.startsWith("writ") || v === "wrote") return "Wrote";
  if (v.startsWith("creat")) return "Created";
  if (v.startsWith("updat")) return "Updated";
  if (v.startsWith("modif")) return "Modified";
  if (v.startsWith("add")) return "Added";
  if (v.startsWith("delet") || v.startsWith("remov")) return "Deleted";
  return "Edited";
}

/** Recognizes a file edit/write/create line → "Edited src/foo.ts". */
function recognizeFileAction(
  raw: string,
  type: AgentStreamEventType
): string | null {
  const verb = raw.match(FILE_VERB_RE);
  const path = raw.match(PATH_RE);
  if (verb && path) {
    return `${normalizeFileVerb(verb[1])} ${path[0]}`;
  }
  // A tool line that clearly names a file but no verb we recognize — still an
  // action worth surfacing (e.g. a "Read src/foo.ts" tool call).
  if (type === "tool" && path) {
    return raw;
  }
  // "Writing file", "Creating directory", … — a verb with an explicit "file".
  if (verb && /\bfile\b/i.test(raw)) {
    return raw;
  }
  return null;
}

/** Strips a leading shell prompt so "$ npm test" reads as "Ran npm test". */
function cleanCommand(raw: string): string {
  const dollar = raw.match(/^\s*\$\s+(.*)$/);
  if (dollar) return `Ran ${dollar[1].trim()}`;
  return raw.trim();
}

/**
 * Content-pattern recognition shared by text/tool/result/raw events.
 * Returns null when nothing matches so the caller falls back to the emitter's
 * label and the type's default tone.
 */
function recognizeLine(
  raw: string,
  type: AgentStreamEventType
): HumanizedEvent | null {
  if (!raw) return null;

  // Result signals first so a failing test line can't be mistaken for a file
  // action or a command. A "0 errors" line is a success despite naming failures.
  if (CLEAN_RESULT_RE.test(raw)) {
    return present("result", raw);
  }
  if (FAILURE_RE.test(raw)) {
    return present("error", raw);
  }
  if (SUCCESS_RE.test(raw)) {
    return present("result", raw);
  }

  const fileAction = recognizeFileAction(raw, type);
  if (fileAction) {
    return present("action", fileAction);
  }

  if (COMMAND_RE.test(raw)) {
    return present("action", cleanCommand(raw));
  }

  return null;
}

/**
 * Maps a stored event to its humanized form.
 *
 * Recognizes the common Claude Code / shell stdout shapes so the default feed
 * reads like a CEO-appropriate activity log: lifecycle markers become friendly
 * phrasing, file edits become "Edited <path>", commands/tests become actions,
 * and pass/fail lines get a result/error tone. Anything unrecognized falls
 * back to the emitter's already-cleaned `label` and the type's default tone.
 * Pure and client-safe — no Prisma/Node imports.
 *
 * @param event - A stored agent stream event.
 * @returns Presentation-ready icon/text/tone.
 */
export function humanizeEvent(event: AgentStreamEvent): HumanizedEvent {
  const raw = (event.label?.trim() || event.detail?.trim() || "").trim();

  // stderr is always an error tone, whatever the line says.
  if (event.type === "stderr") {
    return present("error", raw || "(stderr)");
  }

  // Lifecycle markers get their own friendly phrasing.
  if (event.type === "status") {
    return present("status", humanizeStatus(raw));
  }

  // Content recognition for text/tool/result/raw lines.
  const recognized = recognizeLine(raw, event.type);
  if (recognized) return recognized;

  // Fallthrough: trust the emitter's label, tone by type.
  const tone = TONE_BY_TYPE[event.type] ?? "info";
  return present(tone, raw || "(no output)");
}
