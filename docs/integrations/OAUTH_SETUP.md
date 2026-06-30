# Provider OAuth Setup (GitHub · Linear)

Engineering OS connects to GitHub and Linear via OAuth so the CEO can
authenticate during onboarding (or on **Connections** / **Integrations**), and
the company can pull/display projects and select/create repositories.

OAuth is **optional and degrades gracefully**: when a provider's client
id/secret are absent, its "Connect" button shows _"… not configured"_ and the
**manual access-token** fallback remains available. No provider config is
required to run the app.

> Security note: the values below are **secrets**. Put real values in `.env`
> (git-ignored), **not** in `.env.example` (committed). Never prefix any of
> them with `NEXT_PUBLIC_`. Rotate any secret that lands in a committed file.

---

## 1. Shared configuration

Add to `.env`:

```bash
# Absolute base URL the app is served from. The callback URL is derived as
# ${OAUTH_REDIRECT_BASE_URL}/api/integrations/<provider>/callback and MUST match
# what you register with each provider, byte-for-byte.
OAUTH_REDIRECT_BASE_URL="http://localhost:3000"

# Dedicated HMAC key for signing OAuth state (CSRF). Distinct from
# CREDENTIALS_ENCRYPTION_KEY. Generate with:
#   node -e "require('crypto').randomBytes(32).toString('hex')"
OAUTH_STATE_SECRET="<64 hex chars>"
```

The callback URLs you'll register are therefore:

| Provider | Callback URL |
|----------|--------------|
| GitHub   | `${OAUTH_REDIRECT_BASE_URL}/api/integrations/github/callback`  |
| Linear   | `${OAUTH_REDIRECT_BASE_URL}/api/integrations/linear/callback`  |

> Preview deployments: a single `OAUTH_REDIRECT_BASE_URL` means preview origins
> won't match the registered callback. Exercise OAuth against the configured
> base URL (or locally) only.

---

## 2. GitHub (OAuth App — classic)

1. Create an OAuth App: <https://github.com/settings/developers> → **New OAuth App**.
2. **Authorization callback URL** → the GitHub callback URL above.
3. Copy the **Client ID** and generate a **Client secret**.

```bash
GITHUB_OAUTH_CLIENT_ID="Ov23li..."
GITHUB_OAUTH_CLIENT_SECRET="<secret>"
```

- Scopes requested: `repo`, `read:org`, `workflow` (space-delimited). The user
  may grant a subset — the repository picker requires `repo` and will prompt a
  reconnect if it's missing.
- Classic OAuth App tokens **do not expire** and have no refresh token.
- Email may be `null` (we don't request `user:email`); this is tolerated.
- A newly **created** repo is made with `auto_init: true` so it has a base
  branch and the autonomous PR loop can open PRs immediately.

---

## 3. Linear (OAuth application)

1. Create an application: <https://linear.app/settings/api/applications> → **New application**.
2. **Callback URL** → the Linear callback URL above.
3. Copy the **Client ID** and **Client secret**.

```bash
LINEAR_OAUTH_CLIENT_ID="<id>"
LINEAR_OAUTH_CLIENT_SECRET="<secret>"
```

- Scopes requested: `read`, `write`, `issues:create` (**comma-separated** — a
  Linear-specific requirement).
- Linear access tokens **expire (~24h)** and return a **refresh token**; the app
  stores the refresh token and lazily refreshes before Linear API calls.
- Linear projects/teams are **read-only display** in this version.

---

## 4. How the flow works (for reviewers)

- **Start** — `GET /api/integrations/<provider>/start?returnTo=<path>` resolves
  the company from the live Clerk session, mints an **HMAC-signed state**
  (carrying a sanitized `returnTo` + a nonce) and sets a **per-provider httpOnly
  nonce cookie**, then 302s to the provider authorize URL.
- **Callback** — `GET /api/integrations/<provider>/callback` verifies the state
  signature/expiry, the cookie-nonce double-submit (constant-time), and
  **re-binds to the live session** (the signed company/user must match the
  session). It then exchanges the code **server-side**, records the connection
  (encrypted at rest), clears the single-use nonce cookie, and redirects to a
  clean `returnTo` with `?connected=<provider>` / `?error=<code>`.
- Tokens/codes are never logged or placed in a redirect URL; both routes send
  `Referrer-Policy: no-referrer`.

## 5. Not configured / disconnect

- If a provider isn't configured, its OAuth button is disabled and the manual
  token fallback stays available on **Connections** / **Integrations**.
- Disconnecting clears stored tokens locally. (Revoking the grant at the
  provider on disconnect is a future enhancement.)
