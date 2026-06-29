import { describe, it, expect } from "vitest";

import {
  buildControlCenterViewModel,
  type ControlCenterInput,
} from "./control-center-view-model";
import type { PendingCheckpoint } from "./approval-checkpoints";
import type { StuckWorkItem } from "./stuck-work-detector";
import type { ProviderCardState, ProviderDef } from "./provider-card-state";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const emptyCompanyState = {
  activeEmployees: 0,
  activeProjects: 0,
  tasksInProgress: 0,
  blockedTasks: 0,
  openRequests: 0,
  memoryBanks: 0,
};

function baseInput(
  overrides: Partial<ControlCenterInput> = {}
): ControlCenterInput {
  return {
    primaryAction: null,
    secondaryActions: [],
    pendingCheckpoints: [],
    stuckWork: [],
    awaitingApprovalRequests: [],
    blockedRequests: [],
    companyState: emptyCompanyState,
    providers: [],
    ...overrides,
  };
}

function checkpoint(
  overrides: Partial<PendingCheckpoint> = {}
): PendingCheckpoint {
  return {
    kind: "review",
    id: "rev_1",
    taskId: "task_1",
    taskTitle: "Implement subscriptions",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function stuck(overrides: Partial<StuckWorkItem> = {}): StuckWorkItem {
  return {
    category: "task_stuck_in_review",
    severity: "medium",
    title: "Task stuck in review",
    description: "Waiting for review.",
    recommendation: "Assign a reviewer.",
    linkPath: "/work/tasks/task_9",
    entityId: "task_9",
    entityType: "task",
    stuckSinceMs: 1000,
    ...overrides,
  };
}

function providerDef(id: string, name: string): ProviderDef {
  return {
    id,
    name,
    description: "",
    requiredScopeSummary: "",
    docsUrl: "",
    tokenFieldLabel: "",
    tokenFieldPlaceholder: "",
  };
}

function cardState(
  cardStatus: ProviderCardState["cardStatus"],
  statusLabel: string
): ProviderCardState {
  return {
    cardStatus,
    statusLabel,
    accountName: null,
    accountEmail: null,
    connectionId: null,
    lastConnectedAt: null,
    errorMessage: null,
    isConnected: cardStatus === "connected",
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("buildControlCenterViewModel", () => {
  it("returns empty attention and zero counts for empty input", () => {
    const vm = buildControlCenterViewModel(baseInput());

    expect(vm.attention).toEqual([]);
    expect(vm.attentionCount).toBe(0);
    expect(vm.criticalCount).toBe(0);
    expect(vm.providerHealth).toEqual([]);
    expect(vm.providerNeedsAttention).toBe(false);
    expect(vm.primaryAction).toBeNull();
  });

  it("maps each source to the correct kind and severity", () => {
    const vm = buildControlCenterViewModel(
      baseInput({
        pendingCheckpoints: [
          checkpoint({ kind: "review", id: "rev_a", taskId: "t_a" }),
          checkpoint({ kind: "qa", id: "qa_a", taskId: "t_b" }),
        ],
        awaitingApprovalRequests: [{ id: "req_a", title: "Approve me" }],
        blockedRequests: [{ id: "req_b", title: "Blocked req" }],
        stuckWork: [
          stuck({ severity: "low", entityId: "s_low" }),
          stuck({
            category: "failed_execution_loop",
            severity: "high",
            entityId: "s_fail",
          }),
        ],
      })
    );

    const byKind = new Map(vm.attention.map((i) => [i.kind, i]));
    expect(byKind.get("review_checkpoint")?.severity).toBe("critical");
    expect(byKind.get("qa_checkpoint")?.severity).toBe("critical");
    expect(byKind.get("awaiting_request")?.severity).toBe("critical");
    expect(byKind.get("blocked")?.severity).toBe("warning");
    expect(byKind.get("stuck")?.severity).toBe("info");
    expect(byKind.get("failed_execution")?.severity).toBe("critical");
  });

  it("preserves the checkpoint payload for inline actions", () => {
    const vm = buildControlCenterViewModel(
      baseInput({
        pendingCheckpoints: [
          checkpoint({ kind: "qa", id: "qa_x", taskId: "task_x" }),
        ],
      })
    );

    const item = vm.attention[0];
    expect(item.checkpoint).toEqual({ kind: "qa", id: "qa_x" });
    expect(item.href).toBe("/work/tasks/task_x");
  });

  it("orders critical before warning before info, then occurredAt desc", () => {
    const older = new Date("2026-06-01T00:00:00.000Z");
    const newer = new Date("2026-06-10T00:00:00.000Z");

    const vm = buildControlCenterViewModel(
      baseInput({
        pendingCheckpoints: [
          checkpoint({ id: "crit_old", taskId: "t1", createdAt: older }),
          checkpoint({ id: "crit_new", taskId: "t2", createdAt: newer }),
        ],
        blockedRequests: [{ id: "warn_1", title: "Warn" }],
        stuckWork: [stuck({ severity: "low", entityId: "info_1" })],
      })
    );

    expect(vm.attention.map((i) => i.id)).toEqual([
      "crit_new",
      "crit_old",
      "warn_1",
      "info_1",
    ]);
  });

  it("de-dupes attention items by id (first wins)", () => {
    const vm = buildControlCenterViewModel(
      baseInput({
        awaitingApprovalRequests: [{ id: "dup", title: "First" }],
        blockedRequests: [{ id: "dup", title: "Second" }],
      })
    );

    expect(vm.attention).toHaveLength(1);
    expect(vm.attention[0].title).toBe("First");
    expect(vm.attention[0].kind).toBe("awaiting_request");
  });

  it("computes attentionCount and criticalCount", () => {
    const vm = buildControlCenterViewModel(
      baseInput({
        pendingCheckpoints: [checkpoint({ id: "c1", taskId: "t1" })],
        awaitingApprovalRequests: [{ id: "a1", title: "A" }],
        blockedRequests: [{ id: "b1", title: "B" }],
        stuckWork: [stuck({ severity: "low", entityId: "i1" })],
      })
    );

    expect(vm.attentionCount).toBe(4);
    expect(vm.criticalCount).toBe(2);
  });

  it("flags providerNeedsAttention when any provider is unhealthy", () => {
    const vm = buildControlCenterViewModel(
      baseInput({
        providers: [
          {
            def: providerDef("github", "GitHub"),
            state: cardState("connected", "Connected"),
          },
          {
            def: providerDef("linear", "Linear"),
            state: cardState("disconnected", "Not connected"),
          },
        ],
      })
    );

    expect(vm.providerNeedsAttention).toBe(true);
    expect(vm.providerHealth).toEqual([
      {
        id: "github",
        name: "GitHub",
        cardStatus: "connected",
        statusLabel: "Connected",
        healthy: true,
      },
      {
        id: "linear",
        name: "Linear",
        cardStatus: "disconnected",
        statusLabel: "Not connected",
        healthy: false,
      },
    ]);
  });

  it("reports healthy providers without attention", () => {
    const vm = buildControlCenterViewModel(
      baseInput({
        providers: [
          {
            def: providerDef("github", "GitHub"),
            state: cardState("connected", "Connected"),
          },
        ],
      })
    );

    expect(vm.providerNeedsAttention).toBe(false);
    expect(vm.providerHealth[0].healthy).toBe(true);
  });
});
