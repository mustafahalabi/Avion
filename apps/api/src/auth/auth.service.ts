import { Injectable, Logger } from "@nestjs/common";
import { verifyToken } from "@clerk/backend";
import { PrismaService } from "../prisma/prisma.service";

/**
 * The authenticated caller's scope: every board query is bounded to it.
 * `companyIds` are the companies the user owns; `userId` scopes per-user data
 * (e.g. unread notifications).
 */
export interface AuthContext {
  readonly userId: string;
  readonly companyIds: readonly string[];
}

/** Minimal JWT payload shape this service consumes. */
export interface VerifiedJwt {
  /** Clerk user id (`sub` claim). */
  readonly sub?: string;
}

/**
 * Verifies Clerk session tokens and resolves them to a database-backed
 * {@link AuthContext}. Fails CLOSED: any missing/invalid token, missing
 * CLERK_SECRET_KEY, or unknown user resolves to `null` and the caller must
 * reject the request.
 *
 * The web client obtains the token via Clerk's `getToken()` and sends it as an
 * `Authorization: Bearer <token>` header (REST) or in the Socket.IO handshake
 * `auth.token` field.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private warnedMissingSecret = false;

  /**
   * JWT verification seam — defaults to Clerk's `verifyToken`, replaceable in
   * tests so no network or real keys are needed.
   */
  verifyJwt: (token: string) => Promise<VerifiedJwt> = async (token) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      if (!this.warnedMissingSecret) {
        this.warnedMissingSecret = true;
        this.logger.error(
          "CLERK_SECRET_KEY is not set — every request will be rejected. " +
            "Set it in apps/api/.env (same Clerk instance as apps/web; in " +
            "keyless dev mode the key is in apps/web/.clerk/).",
        );
      }
      throw new Error("CLERK_SECRET_KEY is not configured");
    }
    return verifyToken(token, { secretKey });
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Authenticates a raw bearer token into an {@link AuthContext}.
   *
   * @param token - The bearer token from the request/handshake, if any.
   * @returns The caller's scope, or `null` when authentication fails.
   */
  async authenticate(token: string | null | undefined): Promise<AuthContext | null> {
    if (!token) return null;

    let clerkId: string;
    try {
      const payload = await this.verifyJwt(token);
      if (!payload.sub) return null;
      clerkId = payload.sub;
    } catch {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) return null;

    const companies = await this.prisma.company.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });

    return { userId: user.id, companyIds: companies.map((c) => c.id) };
  }

  /**
   * Extracts a bearer token from an `Authorization` header value.
   *
   * @param header - Raw header value (e.g. `Bearer eyJ…`), if present.
   * @returns The token, or null when the header is absent/malformed.
   */
  static bearerFromHeader(header: string | undefined | null): string | null {
    if (!header) return null;
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    return match ? match[1] : null;
  }
}
