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
import { BoardService } from "./board.service";

const POLL_MS = Number(process.env.BOARD_POLL_MS ?? 2000);
const CORS_ORIGINS = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

/**
 * Socket.IO gateway for the live board. Polls the database every BOARD_POLL_MS
 * and broadcasts a fresh snapshot to all connected clients *only when the data
 * changed* (cheap hash compare), plus a heartbeat tick every interval so the
 * UI can show "live" and connection latency.
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
  private lastHash = "";
  private connectedClients = 0;

  @WebSocketServer()
  server!: Namespace;

  constructor(private readonly board: BoardService) {}

  afterInit(): void {
    this.logger.log(`Board gateway ready on namespace ${BOARD_NAMESPACE} (poll ${POLL_MS}ms)`);
    this.startPolling();
  }

  async handleConnection(client: Socket): Promise<void> {
    this.connectedClients += 1;
    this.logger.log(`client connected: ${client.id} (total ${this.connectedClients})`);
    // Paint immediately rather than waiting up to POLL_MS for the next tick.
    try {
      const snapshot = await this.board.getSnapshot();
      client.emit(BOARD_EVENTS.snapshot, snapshot);
    } catch (err) {
      this.logger.error("Failed to send initial snapshot", err as Error);
    }
  }

  handleDisconnect(client: Socket): void {
    this.connectedClients = Math.max(0, this.connectedClients - 1);
    this.logger.log(`client disconnected: ${client.id} (total ${this.connectedClients})`);
  }

  @SubscribeMessage(BOARD_EVENTS.requestSnapshot)
  async onRequestSnapshot(client: Socket): Promise<void> {
    const snapshot = await this.board.getSnapshot();
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

    try {
      const snapshot = await this.board.getSnapshot();
      const hash = this.hashSnapshot(snapshot);
      if (hash !== this.lastHash) {
        this.lastHash = hash;
        this.server.emit(BOARD_EVENTS.snapshot, snapshot);
      }
    } catch (err) {
      this.logger.error("Snapshot poll failed", err as Error);
    }
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
