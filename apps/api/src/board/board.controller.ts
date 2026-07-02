import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import type { BoardSnapshot, SessionsResponse } from "@avion/shared";
import {
  ClerkAuthGuard,
  type GuardedRequest,
} from "../auth/clerk-auth.guard";
import { BoardService } from "./board.service";

@Controller("board")
@UseGuards(ClerkAuthGuard)
export class BoardController {
  constructor(private readonly board: BoardService) {}

  /** GET /api/board/snapshot — the caller's board state (initial paint / fallback). */
  @Get("snapshot")
  snapshot(@Req() req: GuardedRequest): Promise<BoardSnapshot> {
    // The guard guarantees req.auth is set.
    return this.board.getSnapshot(req.auth!);
  }

  /** GET /api/board/sessions?limit= — just the caller's recent session feed. */
  @Get("sessions")
  async sessions(
    @Req() req: GuardedRequest,
    @Query("limit") limit?: string,
  ): Promise<SessionsResponse> {
    const parsed = Number(limit);
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
    return { sessions: await this.board.getSessions(req.auth!, take) };
  }
}
