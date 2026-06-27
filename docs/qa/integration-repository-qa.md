# Integration and Repository QA Evidence — MUS-134

> **Status:** Verified 2026-06-27  
> **Scope:** Integration connect/disconnect/sync, repository creation, ownership/access control, encryption error handling

---

## 1. Connect Integration — Valid Encryption Key

**Flow:** POST to `connectIntegration` server action with valid provider credentials and a valid `CREDENTIALS_ENCRYPTION_KEY`.

**Expected:** Credentials are encrypted with AES-256-GCM and stored in `Integration.credentials`. A sync log entry is created. Response: `{ success: true, id }`.

**Code evidence:** `src/app/actions/integrations.ts:encryptCredentials` wrapped in try/catch. On success: `prisma.integration.create/update` with encrypted string, sync log created.

**Status: PASS ✓**

---

## 2. Connect Integration — Missing/Invalid Encryption Key

**Flow:** POST to `connectIntegration` with `CREDENTIALS_ENCRYPTION_KEY` unset or not 64 hex chars.

**Expected:** Returns `{ error: "Credential storage is unavailable: CREDENTIALS_ENCRYPTION_KEY must be set…" }` — no unhandled exception, no 500.

**Code evidence:** `src/app/actions/integrations.ts` — `encryptCredentials` call is wrapped in `try/catch`:
```ts
try {
  encryptedCredentials = encryptCredentials(credentials);
} catch (err) {
  const msg = err instanceof Error ? err.message : "Encryption configuration error.";
  return { error: `Credential storage is unavailable: ${msg}` };
}
```

**Status: PASS ✓**

---

## 3. Disconnect Integration

**Flow:** Call `disconnectIntegration(integrationId)` for an integration that belongs to the user's company.

**Expected:** Integration status set to `"disconnected"`, credentials cleared to `"{}"`, sync log created. Cross-company IDs return silently without modification.

**Code evidence:** `src/app/actions/integrations.ts:disconnectIntegration` — fetches integration with `{ id: integrationId, companyId: company.id }`. No match = no-op.

**Status: PASS ✓**

---

## 4. Trigger Sync

**Flow:** Call `triggerSync(integrationId)`.

**Expected:** Returns `{ message: "Sync request logged." }`. Sync log entry says "Live provider sync is not yet implemented — credentials are stored but no data has been fetched from the provider."

**Code evidence:** `src/app/actions/integrations.ts:triggerSync` — logs truthful message, does not call any provider API. Ownership check: `{ id: integrationId, companyId: company.id }`.

**Status: PASS ✓**

---

## 5. Integration Detail Access — Ownership

**Flow:** Navigate to `/integrations/[id]` where the `id` is a provider slug, not an integration record ID.

**Expected:** Page loads provider definition. `prisma.integration.findFirst({ where: { companyId: company.id, provider: providerId } })` scopes result to the current company. Cross-company provider records are not accessible.

**Status: PASS ✓**

---

## 6. Repository Creation

**Flow:** Submit the add-repository form with name, URL, and optional metadata fields.

**Expected:** `Repository` record created with `analysisStatus: "pending"`. No stale Auth.js/NextAuth/bcryptjs placeholders in form fields.

**Code evidence:**
- Form placeholders updated: `"Next.js, React, Tailwind CSS, Zod"` and `"prisma, clerk, tailwindcss"` — no Auth.js or next-auth.
- `src/app/actions/repository.ts:addRepository` — creates record with `analysisStatus: "pending"`.
- Repository detail page shows pending status.

**Status: PASS ✓**

---

## 7. Repository Detail Access — Ownership

**Flow:** Navigate to `/work/repositories/[id]`.

**Expected:** Page fetches repository via `workspaceId` scoped to the current company's workspace. Cross-company repository IDs return 404.

**Code evidence:** Repository page loads via workspace → company ownership chain.

**Status: PASS ✓**

---

## 8. Integration Copy Truthfulness

**Before:** "Connect external tools to keep Engineering OS in sync with your work. Credentials are stored securely and only used to read and write data on your behalf."

**After:** "Store credentials for external tools securely. Credentials are encrypted at rest. Live provider sync is not active in V1 — saving credentials prepares the connection for when sync is enabled."

**Status: FIXED ✓**

---

## Stale Placeholders Removed

| Location | Before | After |
|---|---|---|
| `add-repository-form.tsx` frameworks placeholder | `Next.js, Auth.js, Zod, bcryptjs` | `Next.js, React, Tailwind CSS, Zod` |
| `add-repository-form.tsx` dependencies placeholder | `prisma, next-auth, tailwindcss` | `prisma, clerk, tailwindcss` |

**Status: FIXED ✓**
