import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BoardController } from "./board.controller";
import { BoardGateway } from "./board.gateway";
import { BoardService } from "./board.service";

@Module({
  imports: [AuthModule],
  controllers: [BoardController],
  providers: [BoardService, BoardGateway],
})
export class BoardModule {}
