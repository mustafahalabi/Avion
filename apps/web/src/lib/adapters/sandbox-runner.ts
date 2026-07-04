/**
 * Execution sandbox for the agent CLI (Goal 1 — sandbox the execution worker).
 *
 * The execution worker runs an AI agent CLI (`claude -p`, `codex exec`) with a
 * permission mode that, at full autonomy, lets the agent run **arbitrary shell
 * commands**. Running that directly on the host is dangerous — a sweeping agent
 * command once SIGTERM'd the local dev server. This module wraps the agent
 * invocation so it can run inside an **isolated Docker container** that mounts
 * only the checkout and cannot see or touch host processes/files. Inside the
 * sandbox the agent can safely run at full power (installs, tests, codegen).
 *
 * The abstraction is a pure argv transform: a {@link SandboxRunner} takes the
 * host invocation the adapter *would* have spawned (`claude`, its args, and the
 * checkout as cwd) and returns the invocation to actually spawn. The `none`
 * runner is the identity — the adapter's behavior is byte-for-byte unchanged, so
 * every existing test keeps passing. The `docker` runner rewrites it into a
 * `docker run` that bind-mounts the checkout, drops host access, and appends the
 * original command inside the container.
 *
 * This module is pure and dependency-free (no child_process, no I/O), so it is
 * fully unit-testable without Docker installed.
 */

/**
 * Environment map this module reads. Deliberately looser than the project's
 * augmented `NodeJS.ProcessEnv` (which requires `NODE_ENV`) so tests can pass a
 * plain `{}` — `process.env` still satisfies it.
 */
export type SandboxEnv = Record<string, string | undefined>;

/** How the agent CLI is isolated during a session. */
export type SandboxKind = "none" | "docker";

export const SANDBOX_KINDS: readonly SandboxKind[] = ["none", "docker"] as const;

/** A concrete process invocation: a binary, its argv, and the working directory. */
export interface AgentInvocation {
  /** Binary to spawn (e.g. "claude", "codex", or "docker" after wrapping). */
  command: string;
  /** Arguments passed to the binary. */
  args: string[];
  /**
   * Working directory for the spawn. For the `none` runner this is the checkout
   * path (unchanged host behavior). For the `docker` runner the container's
   * `-w` flag owns the workdir, so this is left undefined (inherit).
   */
  cwd: string | undefined;
}

/** The host invocation the adapter would run without any sandbox. */
export interface HostInvocation {
  /** Agent binary, e.g. "claude". */
  command: string;
  /** Agent argv, e.g. ["-p", "--permission-mode", "bypassPermissions"]. */
  args: string[];
  /** Absolute path to the checked-out repository on the host. */
  repositoryPath: string;
}

/** Wraps a host agent invocation into the process actually spawned. */
export interface SandboxRunner {
  /** Which isolation strategy this runner implements. */
  readonly kind: SandboxKind;
  /**
   * Transform the host invocation into the invocation to spawn.
   *
   * @param host - The command/args/checkout the adapter would run on the host.
   * @returns The (possibly wrapped) invocation to pass to `spawn`.
   */
  wrap(host: HostInvocation): AgentInvocation;
  /** Short human-readable description for worker logs. */
  describe(): string;
}

/**
 * Identity runner — spawns the agent directly on the host, unchanged.
 *
 * This is the default so behavior is identical to before the sandbox existed;
 * host safety in this mode relies on the `WORKER_PERMISSION_MODE` cap (see
 * {@link ../worker-effective-permission}).
 */
export class NoneSandboxRunner implements SandboxRunner {
  readonly kind = "none" as const;

  wrap(host: HostInvocation): AgentInvocation {
    return {
      command: host.command,
      args: [...host.args],
      cwd: host.repositoryPath,
    };
  }

  describe(): string {
    return "none (agent runs directly on the host)";
  }
}

/** Tunables for the Docker sandbox. All are optional with safe defaults. */
export interface DockerSandboxConfig {
  /** Container image with the agent CLI + git installed (see Dockerfile.sandbox). */
  image: string;
  /** Container path the checkout is mounted at. */
  workdir: string;
  /**
   * Docker `--network` value. The agent needs network to reach the model API,
   * so this defaults to "bridge"; set to "none" for an offline sandbox.
   */
  network: string;
  /** `--memory` limit (e.g. "2g"), or null to leave unlimited. */
  memory: string | null;
  /** `--cpus` limit (e.g. "2"), or null to leave unlimited. */
  cpus: string | null;
  /** `--pids-limit` (fork-bomb guard), or null to leave unlimited. */
  pidsLimit: number | null;
  /**
   * `--user` value (e.g. "1000:1000"). Running as the host UID/GID keeps files
   * the agent creates in the bind-mounted checkout owned by the host user, so
   * the host-side git commit/push after the run is not blocked by root-owned
   * files. Null → the image's default user.
   */
  user: string | null;
  /**
   * Names of host env vars to forward into the container with `-e NAME` (value
   * inherited from the host). Used to pass agent credentials (e.g.
   * ANTHROPIC_API_KEY) without baking them into the image. Only names actually
   * present in `env` are forwarded.
   */
  envPassthrough: string[];
  /**
   * Extra `-v host:container[:ro]` bind mounts (e.g. an authenticated
   * `~/.claude` config dir). Passed verbatim after the checkout mount.
   */
  mounts: string[];
  /** Run the container with a proper init (`--init`) for signal/zombie handling. */
  init: boolean;
}

/** Defaults for {@link DockerSandboxConfig}. */
export const DEFAULT_DOCKER_CONFIG: DockerSandboxConfig = {
  image: "avion-agent-sandbox:latest",
  workdir: "/workspace",
  network: "bridge",
  memory: null,
  cpus: null,
  pidsLimit: null,
  user: null,
  envPassthrough: [
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_MODEL",
    "OPENAI_API_KEY",
    "CODEX_API_KEY",
  ],
  mounts: [],
  init: true,
};

/**
 * Docker runner — rewrites the host invocation into a `docker run` that isolates
 * the agent inside a container whose only view of the host is the bind-mounted
 * checkout.
 */
export class DockerSandboxRunner implements SandboxRunner {
  readonly kind = "docker" as const;

  private readonly config: DockerSandboxConfig;
  private readonly env: SandboxEnv;

  /**
   * @param config - Partial overrides merged over {@link DEFAULT_DOCKER_CONFIG}.
   * @param env - Host environment, read only to decide which passthrough vars
   *   are present. Defaults to `process.env`.
   */
  constructor(config: Partial<DockerSandboxConfig> = {}, env: SandboxEnv = process.env) {
    this.config = { ...DEFAULT_DOCKER_CONFIG, ...config };
    this.env = env;
  }

  wrap(host: HostInvocation): AgentInvocation {
    const c = this.config;
    const args: string[] = ["run", "--rm", "-i"];

    if (c.init) args.push("--init");
    // Isolate the container from the host network by default is too strict (the
    // agent needs the model API) — expose the configured network explicitly.
    args.push("--network", c.network);
    if (c.user) args.push("--user", c.user);
    if (c.memory) args.push("--memory", c.memory);
    if (c.cpus) args.push("--cpus", c.cpus);
    if (c.pidsLimit != null) args.push("--pids-limit", String(c.pidsLimit));

    // The ONLY host path the container can see: the checkout, mounted rw so the
    // agent's edits land back on the host for the host-side git commit/push.
    args.push("-v", `${host.repositoryPath}:${c.workdir}`, "-w", c.workdir);
    for (const mount of c.mounts) {
      args.push("-v", mount);
    }

    // Forward credential env vars by name (value inherited by docker from the
    // host env) — only those actually set, so we never pass empty secrets.
    for (const name of c.envPassthrough) {
      if (this.env[name] !== undefined && this.env[name] !== "") {
        args.push("-e", name);
      }
    }

    // The image, then the original agent command + args run INSIDE the container.
    args.push(c.image, host.command, ...host.args);

    return { command: "docker", args, cwd: undefined };
  }

  describe(): string {
    const limits = [
      this.config.memory ? `mem=${this.config.memory}` : null,
      this.config.cpus ? `cpus=${this.config.cpus}` : null,
      this.config.pidsLimit != null ? `pids=${this.config.pidsLimit}` : null,
    ]
      .filter(Boolean)
      .join(",");
    return `docker (image=${this.config.image}${limits ? `, ${limits}` : ""})`;
  }
}

/**
 * Reads a boolean-ish env var. Truthy for "1"/"true"/"yes"/"on" (case-insensitive).
 */
function envBool(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/** Splits a comma/whitespace-separated env list into trimmed non-empty entries. */
function envList(value: string | undefined): string[] | null {
  if (value === undefined) return null;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return items;
}

/**
 * Resolves the current process's `uid:gid`, or null when unavailable (Windows,
 * or when `WORKER_SANDBOX_USER` is set to override it).
 */
function resolveHostUserGid(env: SandboxEnv): string | null {
  const explicit = env.WORKER_SANDBOX_USER;
  if (explicit !== undefined) {
    // Empty string explicitly disables the --user flag (image default user).
    return explicit.trim() === "" ? null : explicit.trim();
  }
  const getuid = process.getuid?.bind(process);
  const getgid = process.getgid?.bind(process);
  if (getuid && getgid) {
    return `${getuid()}:${getgid()}`;
  }
  return null;
}

/**
 * Builds a {@link SandboxRunner} from environment variables.
 *
 * | Env var                      | Meaning                                        | Default |
 * |------------------------------|------------------------------------------------|---------|
 * | `WORKER_SANDBOX`             | `none` \| `docker`                             | `none`  |
 * | `WORKER_SANDBOX_IMAGE`       | container image with the agent CLI             | `avion-agent-sandbox:latest` |
 * | `WORKER_SANDBOX_NETWORK`    | docker `--network`                              | `bridge` |
 * | `WORKER_SANDBOX_MEMORY`     | docker `--memory` (e.g. `2g`)                   | unset |
 * | `WORKER_SANDBOX_CPUS`       | docker `--cpus` (e.g. `2`)                      | unset |
 * | `WORKER_SANDBOX_PIDS_LIMIT` | docker `--pids-limit`                           | unset |
 * | `WORKER_SANDBOX_USER`       | docker `--user` (`""` disables; unset → host uid:gid) | host uid:gid |
 * | `WORKER_SANDBOX_ENV`        | comma list of env names to forward             | credential defaults |
 * | `WORKER_SANDBOX_MOUNTS`     | comma list of extra `-v` mounts                | none |
 *
 * An unrecognized `WORKER_SANDBOX` value falls back to `none` (fail-safe: never
 * silently run an unknown isolation strategy).
 *
 * @param env - Environment to read (defaults to `process.env`).
 * @returns The resolved runner.
 */
export function resolveSandboxRunner(env: SandboxEnv = process.env): SandboxRunner {
  const kind = (env.WORKER_SANDBOX ?? "none").trim().toLowerCase();
  if (kind !== "docker") {
    return new NoneSandboxRunner();
  }

  const pids = env.WORKER_SANDBOX_PIDS_LIMIT ? Number(env.WORKER_SANDBOX_PIDS_LIMIT) : null;
  const overrides: Partial<DockerSandboxConfig> = {
    image: env.WORKER_SANDBOX_IMAGE?.trim() || DEFAULT_DOCKER_CONFIG.image,
    network: env.WORKER_SANDBOX_NETWORK?.trim() || DEFAULT_DOCKER_CONFIG.network,
    memory: env.WORKER_SANDBOX_MEMORY?.trim() || null,
    cpus: env.WORKER_SANDBOX_CPUS?.trim() || null,
    pidsLimit: pids != null && Number.isFinite(pids) ? pids : null,
    user: resolveHostUserGid(env),
    mounts: envList(env.WORKER_SANDBOX_MOUNTS) ?? [],
    init: env.WORKER_SANDBOX_INIT !== undefined ? envBool(env.WORKER_SANDBOX_INIT) : DEFAULT_DOCKER_CONFIG.init,
  };
  const passthrough = envList(env.WORKER_SANDBOX_ENV);
  if (passthrough) overrides.envPassthrough = passthrough;

  return new DockerSandboxRunner(overrides, env);
}
