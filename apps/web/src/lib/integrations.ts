export const INTEGRATION_PROVIDERS = [
  {
    id: "linear",
    name: "Linear",
    description: "Sync projects, issues, and cycles from Linear.",
    category: "work",
    docsUrl: "https://linear.app/settings/api",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "lin_api_…", required: true },
      { key: "workspaceId", label: "Workspace ID (optional)", type: "text", placeholder: "your-workspace", required: false },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Import repositories, pull requests, and releases.",
    category: "code",
    docsUrl: "https://github.com/settings/tokens",
    fields: [
      { key: "accessToken", label: "Personal Access Token", type: "password", placeholder: "ghp_…", required: true },
      { key: "org", label: "Organization or username", type: "text", placeholder: "your-org", required: true },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Post company updates and receive notifications in Slack.",
    category: "communication",
    docsUrl: "https://api.slack.com/apps",
    fields: [
      { key: "webhookUrl", label: "Incoming Webhook URL", type: "password", placeholder: "https://hooks.slack.com/…", required: true },
    ],
  },
] as const;

export type ProviderConfig = (typeof INTEGRATION_PROVIDERS)[number];
