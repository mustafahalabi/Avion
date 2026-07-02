import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { resolveApiDatabaseUrl, type DatabaseUrlSource } from "./database-url";

/**
 * Shared PostgreSQL access for the api. Uses the same `@prisma/adapter-pg`
 * driver adapter the web app uses, pointed at the same database — so the
 * board reads the live Avion database. This api treats the DB as read-only:
 * prefer connecting via API_DATABASE_URL with the SELECT-only `avion_api_ro`
 * role (scripts/provision-readonly-role.ts) so that is enforced by Postgres,
 * not just convention; DATABASE_URL remains the local-dev fallback.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly urlSource: DatabaseUrlSource;

  constructor() {
    const { url, source } = resolveApiDatabaseUrl();
    const adapter = new PrismaPg({ connectionString: url });
    super({ adapter });
    this.urlSource = source;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log(`Connected to PostgreSQL (shared Avion database) via ${this.urlSource}.`);
      if (this.urlSource === "DATABASE_URL") {
        this.logger.warn(
          "Connected with the shared DATABASE_URL — writes are not technically blocked. " +
            "Set API_DATABASE_URL to the read-only avion_api_ro role for a DB-enforced " +
            "guarantee (pnpm --filter @avion/api db:provision-readonly).",
        );
      }
    } catch (err) {
      this.logger.error("Failed to connect to PostgreSQL", err as Error);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
