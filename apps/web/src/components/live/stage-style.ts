import {
  CheckCircle2,
  CircleDashed,
  Eye,
  FlaskConical,
  Hammer,
  Map as MapIcon,
} from "lucide-react";

import type { WorkStage } from "@/lib/work-lifecycle";

export interface StageStyle {
  readonly icon: React.ElementType;
  /** Text accent for the stage label. */
  readonly accent: string;
  /** Count chip background + text. */
  readonly chip: string;
  /** Icon container background + ring. */
  readonly iconWrap: string;
  /** Solid colour used for the pipeline progress segment + the bar dot. */
  readonly bar: string;
}

/**
 * Per-stage colour + icon language, shared by the board columns, the pipeline
 * bar, and the Control Center widget so the Live view reads as one system.
 */
export const STAGE_STYLE: Record<WorkStage, StageStyle> = {
  planning: {
    icon: MapIcon,
    accent: "text-neutral-400",
    chip: "bg-neutral-500/15 text-neutral-300",
    iconWrap: "bg-neutral-500/15 ring-neutral-500/30",
    bar: "bg-neutral-500",
  },
  queued: {
    icon: CircleDashed,
    accent: "text-neutral-300",
    chip: "bg-neutral-800 text-neutral-300",
    iconWrap: "bg-neutral-800 ring-neutral-700",
    bar: "bg-neutral-500",
  },
  building: {
    icon: Hammer,
    // Building = actively working now → vermilion, the reserved "live" accent.
    accent: "text-brand-400",
    chip: "bg-brand-500/15 text-brand-300",
    iconWrap: "bg-brand-500/15 ring-brand-500/30",
    bar: "bg-brand-500",
  },
  review: {
    icon: Eye,
    accent: "text-amber-400",
    chip: "bg-amber-500/15 text-amber-300",
    iconWrap: "bg-amber-500/15 ring-amber-500/30",
    bar: "bg-amber-500",
  },
  qa: {
    icon: FlaskConical,
    accent: "text-neutral-400",
    chip: "bg-neutral-500/15 text-neutral-300",
    iconWrap: "bg-neutral-500/15 ring-neutral-500/30",
    bar: "bg-neutral-500",
  },
  done: {
    icon: CheckCircle2,
    accent: "text-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-300",
    iconWrap: "bg-emerald-500/15 ring-emerald-500/30",
    bar: "bg-emerald-500",
  },
};
