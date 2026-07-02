import { describe, expect, it, vi } from "vitest";

import { BOARD_EVENTS, type BoardSnapshot } from "@avion/shared";
import { BoardGateway } from "./board.gateway";
import type { BoardService } from "./board.service";
import type { AuthContext, AuthService } from "../auth/auth.service";

/** Minimal BoardSnapshot tagged so tests can tell scopes apart. */
function snap(tag: string): BoardSnapshot {
  return {
    metrics: { tag },
    statusCounts: {},
    recentSessions: [],
  } as unknown as BoardSnapshot;
}

interface FakeSocket {
  id: string;
  data: { auth?: AuthContext };
  handshake: { auth: { token?: unknown }; headers: Record<string, string> };
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function makeSocket(id: string, token?: unknown): FakeSocket {
  return {
    id,
    data: {},
    handshake: { auth: token === undefined ? {} : { token }, headers: {} },
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
}

/**
 * Builds a gateway with a mocked auth + board service and a fake Socket.IO
 * namespace whose `sockets` map + `emit` are controllable.
 */
function makeGateway(options?: {
  authenticate?: (token: unknown) => Promise<AuthContext | null>;
  getSnapshot?: (auth: AuthContext) => Promise<BoardSnapshot>;
}) {
  const authenticate = vi.fn(
    options?.authenticate ??
      (async () => ({ userId: "user-1", companyIds: ["c1"] }) as AuthContext),
  );
  const getSnapshot = vi.fn(
    options?.getSnapshot ??
      (async (auth: AuthContext) => snap(auth.companyIds.join(","))),
  );

  const auth = { authenticate } as unknown as AuthService;
  const board = { getSnapshot } as unknown as BoardService;
  const gateway = new BoardGateway(board, auth);

  const serverEmit = vi.fn();
  const sockets = new Map<string, FakeSocket>();
  // The gateway only uses `server.emit` (tick broadcast) and `server.sockets`.
  (gateway as unknown as { server: unknown }).server = {
    emit: serverEmit,
    sockets,
  };

  return { gateway, authenticate, getSnapshot, serverEmit, sockets };
}

/** Invokes the private broadcastTick loop. */
function tick(gateway: BoardGateway): Promise<void> {
  return (
    gateway as unknown as { broadcastTick: () => Promise<void> }
  ).broadcastTick();
}

/** Reads the private connected-client counter. */
function connected(gateway: BoardGateway): number {
  return (gateway as unknown as { connectedClients: number }).connectedClients;
}

describe("BoardGateway", () => {
  describe("handleConnection (handshake auth)", () => {
    it("rejects and disconnects an unauthenticated socket without emitting a snapshot", async () => {
      const { gateway, getSnapshot } = makeGateway({
        authenticate: async () => null,
      });
      const socket = makeSocket("s1", "bad-token");

      await gateway.handleConnection(socket as never);

      expect(socket.emit).toHaveBeenCalledWith("board:error", {
        message: "Unauthorized",
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      // No snapshot is ever emitted to an unauthenticated socket.
      expect(socket.emit).not.toHaveBeenCalledWith(
        BOARD_EVENTS.snapshot,
        expect.anything(),
      );
      expect(getSnapshot).not.toHaveBeenCalled();
      expect(socket.data.auth).toBeUndefined();
      expect(connected(gateway)).toBe(0);
    });

    it("authenticates and paints an initial scoped snapshot", async () => {
      const { gateway, getSnapshot } = makeGateway({
        authenticate: async () => ({ userId: "u1", companyIds: ["c1"] }),
      });
      const socket = makeSocket("s1", "good-token");

      await gateway.handleConnection(socket as never);

      expect(socket.data.auth).toEqual({ userId: "u1", companyIds: ["c1"] });
      expect(getSnapshot).toHaveBeenCalledWith({ userId: "u1", companyIds: ["c1"] });
      expect(socket.emit).toHaveBeenCalledWith(BOARD_EVENTS.snapshot, snap("c1"));
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(connected(gateway)).toBe(1);
    });
  });

  describe("broadcastTick (per-scope isolation + dedup)", () => {
    it("emits a heartbeat tick to the whole namespace", async () => {
      const { gateway, serverEmit, sockets } = makeGateway();
      sockets.set("s1", { ...makeSocket("s1"), data: { auth: { userId: "u1", companyIds: ["c1"] } } });
      (gateway as unknown as { connectedClients: number }).connectedClients = 1;

      await tick(gateway);

      expect(serverEmit).toHaveBeenCalledWith(
        BOARD_EVENTS.tick,
        expect.objectContaining({ seq: expect.any(Number) }),
      );
    });

    it("queries once per scope and delivers each socket only its own scope's snapshot", async () => {
      const { gateway, getSnapshot, sockets } = makeGateway();
      const a = { ...makeSocket("a"), data: { auth: { userId: "u1", companyIds: ["c1"] } } };
      const b = { ...makeSocket("b"), data: { auth: { userId: "u2", companyIds: ["c2"] } } };
      sockets.set("a", a);
      sockets.set("b", b);
      (gateway as unknown as { connectedClients: number }).connectedClients = 2;

      await tick(gateway);

      // Two distinct scopes → two getSnapshot queries, each bounded to its auth.
      expect(getSnapshot).toHaveBeenCalledTimes(2);
      expect(a.emit).toHaveBeenCalledWith(BOARD_EVENTS.snapshot, snap("c1"));
      expect(b.emit).toHaveBeenCalledWith(BOARD_EVENTS.snapshot, snap("c2"));
      // Cross-tenant guard: a never receives b's snapshot and vice versa.
      expect(a.emit).not.toHaveBeenCalledWith(BOARD_EVENTS.snapshot, snap("c2"));
      expect(b.emit).not.toHaveBeenCalledWith(BOARD_EVENTS.snapshot, snap("c1"));
    });

    it("collapses identical scopes into a single query shared by both sockets", async () => {
      const { gateway, getSnapshot, sockets } = makeGateway();
      const a = { ...makeSocket("a"), data: { auth: { userId: "u1", companyIds: ["c1"] } } };
      const b = { ...makeSocket("b"), data: { auth: { userId: "u1", companyIds: ["c1"] } } };
      sockets.set("a", a);
      sockets.set("b", b);
      (gateway as unknown as { connectedClients: number }).connectedClients = 2;

      await tick(gateway);

      expect(getSnapshot).toHaveBeenCalledTimes(1);
      expect(a.emit).toHaveBeenCalledWith(BOARD_EVENTS.snapshot, snap("c1"));
      expect(b.emit).toHaveBeenCalledWith(BOARD_EVENTS.snapshot, snap("c1"));
    });

    it("suppresses an unchanged snapshot on the next tick (hashSnapshot dedup)", async () => {
      const { gateway, sockets } = makeGateway({
        // Same snapshot every call → the second tick must not re-emit it.
        getSnapshot: async () => snap("stable"),
      });
      const a = { ...makeSocket("a"), data: { auth: { userId: "u1", companyIds: ["c1"] } } };
      sockets.set("a", a);
      (gateway as unknown as { connectedClients: number }).connectedClients = 1;

      await tick(gateway);
      await tick(gateway);

      const snapshotEmits = a.emit.mock.calls.filter(
        (call) => call[0] === BOARD_EVENTS.snapshot,
      );
      expect(snapshotEmits).toHaveLength(1);
    });

    it("does not query the database when no clients are connected", async () => {
      const { gateway, getSnapshot } = makeGateway();
      // connectedClients defaults to 0.
      await tick(gateway);
      expect(getSnapshot).not.toHaveBeenCalled();
    });
  });
});
