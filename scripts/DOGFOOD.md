# Dogfooding the self-driving loop

Two ways to watch Avion drive a task from an approved plan all the way
to "done" with no manual clicks.

---

## 1. Local dogfood — no external accounts (run this first)

```bash
npm run dogfood:local
```

Proves the whole loop against **real code paths**, a **real temp database**, and a
**real git remote** (a local bare repo). It exercises, in order:

1. **Driver tick → auto-prepare** the next executable task (MUS-210/211)
2. **Worker checkout + pre-push guardrail gate** (MUS-213)
3. **Commit & push** the session branch to origin, and verifies the commit
   actually landed on the remote (MUS-207)
4. **Ingest** the result + commit metadata → task `in-review` (MUS-209)
5. **Auto-advance review → QA → done** by autonomy level (MUS-212)
6. **Driver re-tick** is a stable no-op (MUS-211)

The **only** stubbed parts are the AI agent step (`claude -p`, replaced by a
deterministic file write) and the GitHub PR API (the local "origin" is a bare
git repo, not GitHub). Everything else is production code. It builds its schema
from `prisma/dev.db`, so run `npx prisma migrate dev` once if you don't have it.

---

## 2. Full end-to-end — real GitHub + real Claude

This is the actual self-driving run. It needs **your** credentials, makes real
commits/PRs, and spends Claude usage, so it is run manually rather than in CI.

### Quick path (scripted)

1. Create a throwaway GitHub sandbox repo (one commit on its default branch) and
   a PAT with `repo` scope.
2. Put the secrets in **`.env.live`** (gitignored):

   ```
   SANDBOX_REPO_URL=https://github.com/<you>/<sandbox>
   GITHUB_TOKEN=ghp_xxx
   GITHUB_LOGIN=<you>
   # optional: LIVE_GOAL=<the change to make>
   ```

3. Ensure `claude` is authenticated (`claude -p "say hi"` works) and `.env` has
   `CREDENTIALS_ENCRYPTION_KEY`.
4. Run:

   ```bash
   npm run live:prepare      # seed company + repo + encrypted token, prepare one session
   npm run live:worker       # the real worker: clone → claude -p → commit → push → open PR
   npm run live:status       # watch it; prints the PR URL when done
   ```

   The worker auto-detects the sandbox's default branch and opens the PR against
   it. At `assist` autonomy the task then halts at the review checkpoint
   (`advanceTaskGates` → `awaiting_review`); raise the company to `delegate`/
   `autonomous` to have the gates auto-advance to `done`.

   **Revoke the PAT when you're finished.**

### Manual path (UI + smoke-test seeder)

### Prerequisites

- **Claude Code CLI** installed and authenticated: `claude --version` works.
- A **throwaway GitHub sandbox repo** you own (e.g. `you/eos-sandbox`) with at
  least one commit on its default branch.
- A **GitHub token** with `repo` scope (classic PAT or fine-grained with
  contents + pull-requests write).
- The app DB seeded with a **company**, a **repository** row pointing at the
  sandbox (`url = https://github.com/you/eos-sandbox`), and a **GitHub provider
  connection** holding the token (Settings → Integrations → connect GitHub, or
  seed a `ProviderConnection` with `provider="github"`).

### Steps

1. **Set autonomy.** For a fully unattended run set the company's autonomy to
   `delegate` or `autonomous` (Company → Settings). Lower levels intentionally
   pause at approval checkpoints.

2. **Create + approve a plan.** Either submit an outcome in the UI and approve
   the generated plan, or use the smoke-test seeder which does outcome → plan →
   approve → apply → prepare for you:

   ```bash
   COMPANY_ID=<companyId> SANDBOX_REPO_ID=<repositoryId> \
   DATABASE_URL="file:./prisma/dev.db" \
   npx tsx scripts/e2e-agent-test.ts
   ```

3. **Start the worker** (executes prepared sessions — runs `claude -p`, commits,
   pushes, opens the PR):

   ```bash
   DATABASE_URL="file:./prisma/dev.db" npm run worker
   ```

4. **Start the driver** (turns approved work into sessions and advances gates on
   an interval — this is what removes the manual clicks):

   ```bash
   DATABASE_URL="file:./prisma/dev.db" npm run driver
   ```

### What you should see

- The driver logs a tick per company; a task moves `todo → prepared → running`.
- The worker checks out the sandbox, runs the agent, and — if the guardrail gate
  passes — pushes a `feature/...` branch and opens a **real PR** on the sandbox.
- The task page shows the branch, the PR link, and the **execution audit trail**
  (commands, files, any guardrail blocks, outcome — MUS-215).
- At `delegate`/`autonomous`, the gates auto-advance review → QA → `done`. At
  lower autonomy the task halts as "needs CEO action" until you approve.

### Guardrails are always on

Independent of autonomy, the worker refuses to push to a protected branch
(`master`/`main`/`release/*`), refuses protected paths (`.env*`, lockfiles,
`prisma/migrations/**`, `.github/workflows/**`, secrets), and never force-pushes.
A blocked run fails the session with the offending paths recorded in the audit
trail rather than pushing.

### Cleanup

Delete the sandbox branches/PRs the run created, or just reset the sandbox repo.
