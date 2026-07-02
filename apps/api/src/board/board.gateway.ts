import { Logger, type OnModuleDestroy } from "@nestjs/common";
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";
import { BOARD_EVENTS, BOARD_NAMESPACE, type BoardSnapshot } from "@avion/shared";
import { AuthService, type AuthContext } from "../auth/auth.service";
import { BoardService } from "./board.service";

const POLL_MS = Number(process.env.BOARD_POLL_MS ?? 2000);
const CORS_ORIGINS = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

/** Socket with the authenticated caller's scope attached at handshake time. */
type AuthedSocket = Socket & { data: { auth?: AuthContext } };

/**
 * Socket.IO gateway for the live board.
 *
 * Auth: the handshake must carry a valid Clerk token (`auth.token`, or an
 * `Authorization: Bearer` header) — unauthenticated sockets are disconnected
 * before any data is emitted. Each socket's snapshot is bounded to its own
 * companies/user.
 *
 * Broadcast: polls the database every BOARD_POLL_MS and emits a fresh snapshot
 * *per scope* (clients with identical scopes share one query + change hash),
 * plus a heartbeat tick every interval so the UI can show "live" latency.
 */
@WebSocketGateway({
  namespace: BOARD_NAMESPACE,
  cors: { origin: CORS_ORIGINS, credentials: true },
})
export class BoardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(BoardGateway.name);
  private timer: NodeJS.Timeout | null = null;
  private seq = 0;
  /** Last emitted snapshot hash per scope key, pruned to live scopes each tick. */
  private lastHashByScope = new Map<string, string>();
  private connectedClients = 0;

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly board: BoardService,
    private readonly auth: AuthService,
  ) {}

  afterInit(): void {
    this.logger.log(`Board gateway ready on namespace ${BOARD_NAMESPACE} (poll ${POLL_MS}ms)`);
    this.startPolling();
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    // Handshake auth: token from Socket.IO `auth` payload or a bearer header.
    const handshakeToken =
      typeof client.handshake.auth?.token === "string"
        ? client.handshake.auth.token
        : AuthService.bearerFromHeader(client.handshake.headers.authorization);
    const auth = await this.auth.authenticate(handshakeToken);

    if (!auth) {
      this.logger.warn(`client ${client.id} rejected: missing/invalid Clerk token`);
      client.emit("board:error", { message: "Unauthorized" });
      client.disconnect(true);
      return;
    }

    client.data.auth = auth;
    this.connectedClients += 1;
    this.logger.log(`client connected: ${client.id} (total ${this.connectedClients})`);

    // Paint immediately rather than waiting up to POLL_MS for the next tick.
    try {
      const snapshot = await this.board.getSnapshot(auth);
      client.emit(BOARD_EVENTS.snapshot, snapshot);
    } catch (err) {
      this.logger.error("Failed to send initial snapshot", err as Error);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    // Rejected sockets never incremented the counter.
    if (!client.data.auth) return;
    this.connectedClients = Math.max(0, this.connectedClients - 1);
    this.logger.log(`client disconnected: ${client.id} (total ${this.connectedClients})`);
  }

  @SubscribeMessage(BOARD_EVENTS.requestSnapshot)
  async onRequestSnapshot(client: AuthedSocket): Promise<void> {
    const auth = client.data.auth;
    if (!auth) return;
    const snapshot = await this.board.getSnapshot(auth);
    client.emit(BOARD_EVENTS.snapshot, snapshot);
  }

  private startPolling(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.broadcastTick();
    }, POLL_MS);
    // Don't keep the event loop alive solely for this interval.
    this.timer.unref?.();
  }

  private async broadcastTick(): Promise<void> {
    this.seq += 1;
    this.server.emit(BOARD_EVENTS.tick, { at: new Date().toISOString(), seq: this.seq });

    // No listeners → don't hit the DB.
    if (this.connectedClients === 0) return;

    // Group authenticated sockets by scope so identical scopes share one query.
    const socketsByScope = new Map<string, { auth: AuthContext; sockets: AuthedSocket[] }>();
    for (const socket of this.server.sockets.values()) {
      const auth = (socket as AuthedSocket).data.auth;
      if (!auth) continue;
      const key = this.scopeKey(auth);
      const group = socketsByScope.get(key);
      if (group) {
        group.sockets.push(socket as AuthedSocket);
      } else {
        socketsByScope.set(key, { auth, sockets: [socket as AuthedSocket] });
      }
    }

    for (const [key, group] of socketsByScope) {
      try {
        const snapshot = await this.board.getSnapshot(group.auth);
        const hash = this.hashSnapshot(snapshot);
        if (hash !== this.lastHashByScope.get(key)) {
          this.lastHashByScope.set(key, hash);
          for (const socket of group.sockets) {
            socket.emit(BOARD_EVENTS.snapshot, snapshot);
          }
        }
      } catch (err) {
        this.logger.error("Snapshot poll failed", err as Error);
      }
    }

    // Drop change-hashes for scopes with no connected sockets anymore.
    for (const key of this.lastHashByScope.keys()) {
      if (!socketsByScope.has(key)) this.lastHashByScope.delete(key);
    }
  }

  private scopeKey(auth: AuthContext): string {
    return `${auth.userId}|${[...auth.companyIds].sort().join(",")}`;
  }

  private hashSnapshot(s: BoardSnapshot): string {
    // Cheap change-detection over the fields the UI renders.
    return JSON.stringify({
      m: s.metrics,
      sc: s.statusCounts,
      ids: s.recentSessions.map((x) => `${x.id}:${x.updatedAt}:${x.status}:${x.prStatus ?? ""}`),
    });
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
