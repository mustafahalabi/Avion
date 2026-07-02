import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService, type AuthContext } from "./auth.service";

/** Minimal request shape the guard consumes (framework-agnostic). */
export interface GuardedRequest {
  headers: Record<string, string | string[] | undefined>;
  auth?: AuthContext;
}

/**
 * REST guard: requires a valid Clerk bearer token and attaches the resolved
 * {@link AuthContext} to the request. Rejects with 401 otherwise — the api
 * serves live company data and must never respond unauthenticated.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const header = request.headers.authorization;
    const token = AuthService.bearerFromHeader(
      Array.isArray(header) ? header[0] : header,
    );
    const auth = await this.auth.authenticate(token);
    if (!auth) {
      throw new UnauthorizedException("A valid Clerk bearer token is required.");
    }
    request.auth = auth;
    return true;
  }
}
