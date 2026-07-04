import { describe, expect, it } from "vitest";

import {
  DEFAULT_DOCKER_CONFIG,
  DockerSandboxRunner,
  NoneSandboxRunner,
  resolveSandboxRunner,
  type HostInvocation,
} from "./sandbox-runner";

const CLAUDE_HOST: HostInvocation = {
  command: "claude",
  args: ["-p", "--permission-mode", "bypassPermissions"],
  repositoryPath: "/tmp/eos-worker/session-123",
};

describe("NoneSandboxRunner", () => {
  it("is the identity — spawns the agent directly on the host", () => {
    const runner = new NoneSandboxRunner();
    const invocation = runner.wrap(CLAUDE_HOST);

    expect(runner.kind).toBe("none");
    expect(invocation.command).toBe("claude");
    expect(invocation.args).toEqual(["-p", "--permission-mode", "bypassPermissions"]);
    expect(invocation.cwd).toBe("/tmp/eos-worker/session-123");
  });

  it("returns a fresh args array (does not alias the input)", () => {
    const runner = new NoneSandboxRunner();
    const invocation = runner.wrap(CLAUDE_HOST);
    expect(invocation.args).not.toBe(CLAUDE_HOST.args);
  });
});

describe("DockerSandboxRunner", () => {
  it("wraps the agent into a `docker run` mounting only the checkout", () => {
    const runner = new DockerSandboxRunner({ image: "avion-agent-sandbox:latest" }, {});
    const { command, args, cwd } = runner.wrap(CLAUDE_HOST);

    expect(command).toBe("docker");
    expect(cwd).toBeUndefined();
    // Baseline flags.
    expect(args.slice(0, 3)).toEqual(["run", "--rm", "-i"]);
    expect(args).toContain("--init");
    expect(args).toContain("--network");
    // The checkout is the only host path exposed, mounted at /workspace.
    expect(args).toContain("-v");
    expect(args).toContain("/tmp/eos-worker/session-123:/workspace");
    expect(args).toContain("-w");
    expect(args).toContain("/workspace");
    // The image, then the original command, come last, in order.
    const imageIdx = args.indexOf("avion-agent-sandbox:latest");
    expect(imageIdx).toBeGreaterThan(0);
    expect(args.slice(imageIdx)).toEqual([
      "avion-agent-sandbox:latest",
      "claude",
      "-p",
      "--permission-mode",
      "bypassPermissions",
    ]);
  });

  it("applies resource limits and a custom network when configured", () => {
    const runner = new DockerSandboxRunner(
      { memory: "2g", cpus: "2", pidsLimit: 512, network: "none", user: "1000:1000" },
      {}
    );
    const { args } = runner.wrap(CLAUDE_HOST);

    expect(args).toContain("--memory");
    expect(args).toContain("2g");
    expect(args).toContain("--cpus");
    expect(args).toContain("2");
    expect(args).toContain("--pids-limit");
    expect(args).toContain("512");
    expect(args).toContain("--user");
    expect(args).toContain("1000:1000");
    // network flag reflects the override
    const netIdx = args.indexOf("--network");
    expect(args[netIdx + 1]).toBe("none");
  });

  it("forwards only env-passthrough vars that are actually present", () => {
    const runner = new DockerSandboxRunner(
      { envPassthrough: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "ABSENT_VAR"] },
      { ANTHROPIC_API_KEY: "sk-abc", OPENAI_API_KEY: "" }
    );
    const { args } = runner.wrap(CLAUDE_HOST);

    // Present + non-empty → forwarded by name.
    const envForwards = args.filter((a, i) => args[i - 1] === "-e");
    expect(envForwards).toContain("ANTHROPIC_API_KEY");
    // Empty string is NOT forwarded (never pass an empty secret).
    expect(envForwards).not.toContain("OPENAI_API_KEY");
    // Absent var is NOT forwarded.
    expect(envForwards).not.toContain("ABSENT_VAR");
  });

  it("appends extra mounts after the checkout mount", () => {
    const runner = new DockerSandboxRunner(
      { mounts: ["/home/me/.claude:/tmp/.claude:ro"] },
      {}
    );
    const { args } = runner.wrap(CLAUDE_HOST);
    expect(args).toContain("/home/me/.claude:/tmp/.claude:ro");
  });

  it("omits --init when disabled", () => {
    const runner = new DockerSandboxRunner({ init: false }, {});
    const { args } = runner.wrap(CLAUDE_HOST);
    expect(args).not.toContain("--init");
  });

  it("wraps a /bin/sh command (install/validation surface) the same way", () => {
    const runner = new DockerSandboxRunner({ image: "img" }, {});
    const { command, args } = runner.wrap({
      command: "/bin/sh",
      args: ["-c", "npm ci"],
      repositoryPath: "/co",
    });
    expect(command).toBe("docker");
    const imageIdx = args.indexOf("img");
    expect(args.slice(imageIdx)).toEqual(["img", "/bin/sh", "-c", "npm ci"]);
    expect(args).toContain("/co:/workspace");
  });
});

describe("resolveSandboxRunner", () => {
  it("defaults to the none runner when WORKER_SANDBOX is unset", () => {
    expect(resolveSandboxRunner({}).kind).toBe("none");
  });

  it("falls back to none for an unrecognized value (fail-safe)", () => {
    expect(resolveSandboxRunner({ WORKER_SANDBOX: "vm" }).kind).toBe("none");
  });

  it("returns a docker runner for WORKER_SANDBOX=docker", () => {
    const runner = resolveSandboxRunner({ WORKER_SANDBOX: "docker" });
    expect(runner.kind).toBe("docker");
  });

  it("is case-insensitive on the kind", () => {
    expect(resolveSandboxRunner({ WORKER_SANDBOX: "DOCKER" }).kind).toBe("docker");
  });

  it("reads image, network, limits, mounts and user from env", () => {
    const runner = resolveSandboxRunner({
      WORKER_SANDBOX: "docker",
      WORKER_SANDBOX_IMAGE: "custom:1",
      WORKER_SANDBOX_NETWORK: "none",
      WORKER_SANDBOX_MEMORY: "4g",
      WORKER_SANDBOX_CPUS: "3",
      WORKER_SANDBOX_PIDS_LIMIT: "256",
      WORKER_SANDBOX_USER: "1001:1001",
      WORKER_SANDBOX_MOUNTS: "/a:/b, /c:/d:ro",
    });
    const { args } = runner.wrap(CLAUDE_HOST);
    expect(args).toContain("custom:1");
    expect(args[args.indexOf("--network") + 1]).toBe("none");
    expect(args).toContain("4g");
    expect(args).toContain("3");
    expect(args).toContain("256");
    expect(args).toContain("1001:1001");
    expect(args).toContain("/a:/b");
    expect(args).toContain("/c:/d:ro");
  });

  it("WORKER_SANDBOX_USER='' disables the --user flag", () => {
    const runner = resolveSandboxRunner({
      WORKER_SANDBOX: "docker",
      WORKER_SANDBOX_USER: "",
    });
    const { args } = runner.wrap(CLAUDE_HOST);
    expect(args).not.toContain("--user");
  });

  it("exposes sane defaults", () => {
    expect(DEFAULT_DOCKER_CONFIG.image).toBe("avion-agent-sandbox:latest");
    expect(DEFAULT_DOCKER_CONFIG.network).toBe("bridge");
    expect(DEFAULT_DOCKER_CONFIG.init).toBe(true);
    expect(DEFAULT_DOCKER_CONFIG.envPassthrough).toContain("ANTHROPIC_API_KEY");
  });
});
