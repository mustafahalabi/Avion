import { Controller, Get } from "@nestjs/common";
import type { HealthResponse } from "@avion/shared";
import { PrismaService } from "../prisma/prisma.service";

const startedAt = Date.now();

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /api/health — liveness + database reachability. */
  @Get()
  async health(): Promise<HealthResponse> {
    let db: "up" | "down" = "down";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return {
      status: "ok",
      service: "avion-api",
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      db,
      time: new Date().toISOString(),
    };
  }
}
