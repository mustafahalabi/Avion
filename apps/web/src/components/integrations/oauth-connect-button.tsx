"use client";

import { cn } from "@/lib/utils";

// ─── Brand marks ──────────────────────────────────────────────────────────────

function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function LinearLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.01c0 3.64-1.62 6.903-4.18 9.106L2.887 4.18ZM1.817 5.626l16.557 16.557c-.879.51-1.836.9-2.85 1.149L.668 8.476c.249-1.014.64-1.971 1.15-2.85ZM.064 10.880l13.056 13.056a12.067 12.067 0 0 1-2.295-.273L.337 13.175a12.067 12.067 0 0 1-.273-2.295ZM.014 14.04l9.946 9.946C4.512 23.483.517 19.488.014 14.04Z" />
    </svg>
  );
}

const PROVIDER_BRAND: Record<
  string,
  { name: string; Logo: (props: { className?: string }) => React.ReactElement }
> = {
  github: { name: "GitHub", Logo: GitHubLogo },
  linear: { name: "Linear", Logo: LinearLogo },
};

// ─── Button ───────────────────────────────────────────────────────────────────

interface OAuthConnectButtonProps {
  provider: string;
  /** Whether OAuth env credentials are configured for this provider. */
  configured: boolean;
  /** Relative path to return to after the OAuth round-trip. */
  returnTo: string;
  /** Verb shown before the provider name: "Connect" (default) or "Reconnect". */
  label?: string;
  className?: string;
}

/**
 * Navigates (full page, not fetch) to the provider's OAuth start route, which
 * 302s to the external authorize URL. Renders the provider's brand logo with
 * "Connect with <Provider>". When OAuth env credentials aren't set, it renders a
 * disabled "not configured" hint so onboarding never breaks.
 */
export function OAuthConnectButton({
  provider,
  configured,
  returnTo,
  label = "Connect",
  className,
}: OAuthConnectButtonProps) {
  const brand = PROVIDER_BRAND[provider] ?? {
    name: provider,
    Logo: () => null,
  };
  const { name, Logo } = brand;

  if (!configured) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs font-medium text-neutral-600",
          className
        )}
        title={`OAuth is not configured for ${name}. Set its client id/secret in the environment, or use a manual token below.`}
      >
        <Logo className="h-3.5 w-3.5 opacity-60" />
        {name} · not configured
      </span>
    );
  }

  const href = `/api/integrations/${provider}/start?returnTo=${encodeURIComponent(
    returnTo
  )}`;

  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-100",
        className
      )}
    >
      <Logo className="h-3.5 w-3.5" />
      {label} with {name}
    </a>
  );
}
