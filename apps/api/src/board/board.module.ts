import { Module } from "@nestjs/common";
import { BoardController } from "./board.controller";
import { BoardGateway } from "./board.gateway";
import { BoardService } from "./board.service";

@Module({
  controllers: [BoardController],
  providers: [BoardService, BoardGateway],
})
export class BoardModule {}
