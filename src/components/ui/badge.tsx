import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default:     "bg-neutral-800 text-neutral-200 border-neutral-700",
  secondary:   "bg-neutral-700 text-neutral-300 border-neutral-600",
  success:     "bg-success-950 text-success-400 border-success-800",
  warning:     "bg-warning-950 text-warning-400 border-warning-800",
  destructive: "bg-danger-950 text-danger-400 border-danger-800",
  info:        "bg-info-950 text-info-400 border-info-800",
  outline:     "bg-transparent text-neutral-400 border-neutral-600",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
