import { describe, expect, it } from "vitest";

import { resolveEffectivePermissionLevel } from "./worker-effective-permission";

describe("resolveEffectivePermissionLevel", () => {
  it("honors an explicit override in every mode", () => {
    const overrideOnHost = resolveEffectivePermissionLevel({
      autonomyPermission: "full",
      override: "execute",
      sandboxKind: "none",
      allowUnsandboxedFull: false,
    });
    expect(overrideOnHost.level).toBe("execute");
    expect(overrideOnHost.capped).toBe(false);
    expect(overrideOnHost.reason).toContain("override");

    const overrideInDocker = resolveEffectivePermissionLevel({
      autonomyPermission: "full",
      override: "read_only",
      sandboxKind: "docker",
      allowUnsandboxedFull: false,
    });
    expect(overrideInDocker.level).toBe("read_only");
  });

  it("runs at full autonomy inside a docker sandbox", () => {
    const decision = resolveEffectivePermissionLevel({
      autonomyPermission: "full",
      override: null,
      sandboxKind: "docker",
      allowUnsandboxedFull: false,
    });
    expect(decision.level).toBe("full");
    expect(decision.capped).toBe(false);
    expect(decision.reason).toContain("sandboxed");
  });

  it("caps full → execute on an un-sandboxed host by default", () => {
    const decision = resolveEffectivePermissionLevel({
      autonomyPermission: "full",
      override: null,
      sandboxKind: "none",
      allowUnsandboxedFull: false,
    });
    expect(decision.level).toBe("execute");
    expect(decision.capped).toBe(true);
    expect(decision.reason).toContain("capped");
  });

  it("allows un-sandboxed full when explicitly opted in", () => {
    const decision = resolveEffectivePermissionLevel({
      autonomyPermission: "full",
      override: null,
      sandboxKind: "none",
      allowUnsandboxedFull: true,
    });
    expect(decision.level).toBe("full");
    expect(decision.capped).toBe(false);
  });

  it("does not cap non-full levels on the host", () => {
    for (const level of ["read_only", "suggest", "execute"] as const) {
      const decision = resolveEffectivePermissionLevel({
        autonomyPermission: level,
        override: null,
        sandboxKind: "none",
        allowUnsandboxedFull: false,
      });
      expect(decision.level).toBe(level);
      expect(decision.capped).toBe(false);
    }
  });
});
