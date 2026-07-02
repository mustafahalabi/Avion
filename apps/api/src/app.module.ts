import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { BoardModule } from "./board/board.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    // Loads apps/api/.env into process.env and makes config available app-wide.
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BoardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
