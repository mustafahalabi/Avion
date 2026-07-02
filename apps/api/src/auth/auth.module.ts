import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { ClerkAuthGuard } from "./clerk-auth.guard";

@Module({
  providers: [AuthService, ClerkAuthGuard],
  exports: [AuthService, ClerkAuthGuard],
})
export class AuthModule {}
