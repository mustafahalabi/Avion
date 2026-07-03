import { describe, expect, it } from "vitest";
import net from "node:net";
import {
  getFreePort,
  buildFrameworkPortArgs,
  buildPreviewEnv,
} from "./preview-port";

const HOST = "127.0.0.1";

describe("getFreePort", () => {
  it("returns a port in range that is actually bindable", async () => {
    const port = await getFreePort({
      host: HOST,
      rangeStart: 4100,
      rangeEnd: 4199,
    });
    expect(port).toBeGreaterThanOrEqual(4100);
    expect(port).toBeLessThanOrEqual(4199);

    // The returned port must be free to bind right now.
    await new Promise<void>((resolve, reject) => {
      const srv = net.createServer();
      srv.once("error", reject);
      srv.listen(port, HOST, () => srv.close(() => resolve()));
    });
  });

  it("skips ports held by an occupied set", async () => {
    const port = await getFreePort({
      host: HOST,
      rangeStart: 4100,
      rangeEnd: 4101,
      occupied: new Set([4100]),
    });
    expect(port).not.toBe(4100);
  });

  it("falls back to an ephemeral port when the range is exhausted", async () => {
    // Actually occupy the whole (size-1) range so probing fails, forcing fallback.
    const holder = net.createServer();
    await new Promise<void>((resolve) => holder.listen(4150, HOST, () => resolve()));
    try {
      const port = await getFreePort({
        host: HOST,
        rangeStart: 4150,
        rangeEnd: 4150,
      });
      expect(port).not.toBe(4150);
      expect(port).toBeGreaterThan(0);
    } finally {
      holder.close();
    }
  });
});

describe("buildFrameworkPortArgs", () => {
  it("maps Next.js to -p / -H", () => {
    expect(buildFrameworkPortArgs("next", 4100, HOST)).toBe(" -- -p 4100 -H 127.0.0.1");
  });
  it("maps Vite to --port / --host / --strictPort", () => {
    expect(buildFrameworkPortArgs("vite", 4100, HOST)).toBe(
      " -- --port 4100 --host 127.0.0.1 --strictPort"
    );
  });
  it("returns empty for CRA and generic (env only)", () => {
    expect(buildFrameworkPortArgs("cra", 4100, HOST)).toBe("");
    expect(buildFrameworkPortArgs("generic", 4100, HOST)).toBe("");
  });
});

describe("buildPreviewEnv", () => {
  it("sets PORT/HOST and lets user env win for other keys", () => {
    const env = buildPreviewEnv({
      base: { PATH: "/usr/bin", NODE_ENV: "test" },
      port: 4100,
      host: HOST,
      userEnv: { DATABASE_URL: "postgres://x", NODE_ENV: "development" },
    });
    expect(env.PORT).toBe("4100");
    expect(env.HOST).toBe(HOST);
    expect(env.HOSTNAME).toBe(HOST);
    expect(env.BROWSER).toBe("none");
    expect(env.DATABASE_URL).toBe("postgres://x");
    expect(env.PATH).toBe("/usr/bin");
  });

  it("never lets user env override PORT/HOST", () => {
    const env = buildPreviewEnv({
      base: { NODE_ENV: "test" },
      port: 4100,
      host: HOST,
      userEnv: { PORT: "9999", HOST: "0.0.0.0" },
    });
    expect(env.PORT).toBe("4100");
    expect(env.HOST).toBe(HOST);
  });
});
