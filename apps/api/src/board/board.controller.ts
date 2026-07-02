import { Controller, Get, Query } from "@nestjs/common";
import type { BoardSnapshot, SessionsResponse } from "@avion/shared";
import { BoardService } from "./board.service";

@Controller("board")
export class BoardController {
  constructor(private readonly board: BoardService) {}

  /** GET /api/board/snapshot — the full board state (initial paint / fallback). */
  @Get("snapshot")
  snapshot(): Promise<BoardSnapshot> {
    return this.board.getSnapshot();
  }

  /** GET /api/board/sessions?limit= — just the recent session feed. */
  @Get("sessions")
  async sessions(@Query("limit") limit?: string): Promise<SessionsResponse> {
    const parsed = Number(limit);
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : 20;
    return { sessions: await this.board.getSessions(take) };
  }
}
