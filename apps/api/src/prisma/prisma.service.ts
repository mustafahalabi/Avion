import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Shared PostgreSQL access for the api. Uses the same `@prisma/adapter-pg`
 * driver adapter the web app uses, pointed at the same DATABASE_URL — so the
 * board reads the live Avion database. This api treats the DB as read-only.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set for @avion/api. Copy apps/api/.env.example to " +
          "apps/api/.env and point it at the same PostgreSQL as apps/web.",
      );
    }
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log("Connected to PostgreSQL (shared Avion database).");
    } catch (err) {
      this.logger.error("Failed to connect to PostgreSQL", err as Error);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
