import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { prisma as PrismaSingleton } from "@/lib/prisma";
import type * as PreviewActions from "./preview";
import { setupTestSchema, teardownTestSchema } from "@/lib/test-utils/pg-test-db";

const mockGetCurrentUser = vi.fn();
vi.mock("@/lib/current-user", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

let prisma: typeof PrismaSingleton;
let schema: string;
let actions: typeof PreviewActions;

beforeAll(async () => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "0".repeat(64);
  delete process.env.PREVIEW_DISABLED; // on by default
  ({ prisma, schema } = await setupTestSchema("actions-preview"));
  actions = await import("./preview");

  await prisma.user.create({ data: { id: "user-1", email: "owner@acme.test" } });
  await prisma.company.create({
    data: { id: "company-1", name: "Acme", slug: "acme", ownerId: "user-1" },
  });
  await prisma.workspace.create({
    data: { id: "ws-1", name: "Main", slug: "main", companyId: "company-1" },
  });
  await prisma.repository.create({
    data: { id: "repo-1", workspaceId: "ws-1", name: "app", url: "https://github.com/a/b" },
  });
  await prisma.repository.create({
    data: { id: "repo-nourl", workspaceId: "ws-1", name: "nourl", url: null },
  });

  // A second tenant for cross-company isolation checks.
  await prisma.user.create({ data: { id: "user-2", email: "other@beta.test" } });
  await prisma.company.create({
    data: { id: "company-2", name: "Beta", slug: "beta", ownerId: "user-2" },
  });
});

afterEach(async () => {
  await prisma.$executeRawUnsafe(`DELETE FROM "PreviewSession"`);
  mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
  delete process.env.PREVIEW_DISABLED;
});

afterAll(async () => {
  await teardownTestSchema(prisma, schema);
});

describe("startPreview", () => {
  it("creates a queued row scoped to the company with encrypted env", async () => {
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    const res = await actions.startPreview({
      repositoryId: "repo-1",
      envVars: "DATABASE_URL=postgres://secret",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const row = await prisma.previewSession.findUnique({ where: { id: res.previewId } });
    expect(row?.status).toBe("queued");
    expect(row?.desiredState).toBe("running");
    expect(row?.companyId).toBe("company-1");
    expect(row?.repositoryId).toBe("repo-1");
    // Env is stored encrypted, never as plaintext.
    expect(row?.envVars).toBeTruthy();
    expect(row?.envVars).not.toContain("postgres://secret");
  });

  it("rejects a repository with no URL", async () => {
    const res = await actions.startPreview({ repositoryId: "repo-nourl" });
    expect(res).toMatchObject({ ok: false });
    if (!res.ok) expect(res.error).toContain("no URL");
  });

  it("stores no envVars (no encryption key needed) when none are provided", async () => {
    const res = await actions.startPreview({ repositoryId: "repo-1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await prisma.previewSession.findUnique({ where: { id: res.previewId } });
    expect(row?.envVars).toBeNull();
  });

  it("is gated off only when PREVIEW_DISABLED is set", async () => {
    process.env.PREVIEW_DISABLED = "true";
    try {
      const res = await actions.startPreview({ repositoryId: "repo-1" });
      expect(res).toMatchObject({ ok: false });
      if (!res.ok) expect(res.error).toContain("turned off");
    } finally {
      delete process.env.PREVIEW_DISABLED;
    }
  });

  it("supersedes an existing active preview for the same repo", async () => {
    const existing = await prisma.previewSession.create({
      data: {
        companyId: "company-1",
        workspaceId: "ws-1",
        repositoryId: "repo-1",
        status: "running",
        desiredState: "running",
      },
    });
    const res = await actions.startPreview({ repositoryId: "repo-1" });
    expect(res.ok).toBe(true);

    const old = await prisma.previewSession.findUnique({ where: { id: existing.id } });
    expect(old?.desiredState).toBe("stopped");
  });
});

describe("stopPreview", () => {
  it("sets desiredState to stopped for an owned preview", async () => {
    const row = await prisma.previewSession.create({
      data: {
        companyId: "company-1",
        workspaceId: "ws-1",
        repositoryId: "repo-1",
        status: "running",
        desiredState: "running",
      },
    });
    await actions.stopPreview({ previewId: row.id });
    const after = await prisma.previewSession.findUnique({ where: { id: row.id } });
    expect(after?.desiredState).toBe("stopped");
  });
});

describe("getPreviewStatus", () => {
  it("returns status + logs but never the encrypted env vars", async () => {
    const row = await prisma.previewSession.create({
      data: {
        companyId: "company-1",
        workspaceId: "ws-1",
        repositoryId: "repo-1",
        status: "running",
        desiredState: "running",
        logs: "hello",
        envVars: "encrypted-blob",
      },
    });
    const status = await actions.getPreviewStatus({ previewId: row.id });
    expect(status?.status).toBe("running");
    expect(status?.logs).toBe("hello");
    expect(status && "envVars" in status).toBe(false);
  });

  it("denies cross-company access", async () => {
    const row = await prisma.previewSession.create({
      data: {
        companyId: "company-1",
        workspaceId: "ws-1",
        repositoryId: "repo-1",
        status: "running",
        desiredState: "running",
      },
    });
    // Switch the caller to the other tenant.
    mockGetCurrentUser.mockResolvedValue({ id: "user-2" });
    const status = await actions.getPreviewStatus({ previewId: row.id });
    expect(status).toBeNull();
  });
});
