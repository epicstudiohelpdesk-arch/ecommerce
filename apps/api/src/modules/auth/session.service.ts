import { Injectable } from '@nestjs/common';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { TokenService } from './token.service';

export interface ActiveSessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Persists a newly created server-side user session with a hashed refresh token.
   */
  async createSession(
    userId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
    ttlDays = 7,
  ) {
    const refreshTokenHash = this.tokenService.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const [session] = await this.databaseService.db
      .insert(this.databaseService.schema.userSessions)
      .values({
        userId,
        refreshTokenHash,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ? userAgent.substring(0, 500) : null,
        expiresAt,
      })
      .returning();

    if (!session) {
      throw new Error('Failed to create session');
    }

    return session;
  }

  /**
   * Finds an active, unrevoked and unexpired session by raw refresh token.
   */
  async findValidSession(refreshToken: string) {
    const refreshTokenHash = this.tokenService.hashToken(refreshToken);
    const now = new Date();

    const [session] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.userSessions)
      .where(
        and(
          eq(this.databaseService.schema.userSessions.refreshTokenHash, refreshTokenHash),
          isNull(this.databaseService.schema.userSessions.revokedAt),
          gt(this.databaseService.schema.userSessions.expiresAt, now),
        ),
      )
      .limit(1);

    return session || null;
  }

  /**
   * Rotates the refresh token for an existing session (implements rotating refresh tokens).
   */
  async rotateSession(sessionId: string, newRefreshToken: string, ttlDays = 7) {
    const refreshTokenHash = this.tokenService.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    const [session] = await this.databaseService.db
      .update(this.databaseService.schema.userSessions)
      .set({
        refreshTokenHash,
        expiresAt,
      })
      .where(eq(this.databaseService.schema.userSessions.id, sessionId))
      .returning();

    if (!session) {
      throw new Error('Failed to rotate session');
    }

    return session;
  }

  /**
   * Revokes a specific single session by ID.
   */
  async revokeSession(sessionId: string) {
    await this.databaseService.db
      .update(this.databaseService.schema.userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(this.databaseService.schema.userSessions.id, sessionId));
  }

  /**
   * Revokes all active sessions for a specific user (used on password reset / compromised account).
   */
  async revokeAllUserSessions(userId: string) {
    await this.databaseService.db
      .update(this.databaseService.schema.userSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(this.databaseService.schema.userSessions.userId, userId),
          isNull(this.databaseService.schema.userSessions.revokedAt),
        ),
      );
  }

  /**
   * Lists non-sensitive session summaries for an authenticated user.
   */
  async getUserActiveSessions(userId: string): Promise<ActiveSessionInfo[]> {
    const now = new Date();

    const rows = await this.databaseService.db
      .select({
        id: this.databaseService.schema.userSessions.id,
        ipAddress: this.databaseService.schema.userSessions.ipAddress,
        userAgent: this.databaseService.schema.userSessions.userAgent,
        createdAt: this.databaseService.schema.userSessions.createdAt,
        expiresAt: this.databaseService.schema.userSessions.expiresAt,
      })
      .from(this.databaseService.schema.userSessions)
      .where(
        and(
          eq(this.databaseService.schema.userSessions.userId, userId),
          isNull(this.databaseService.schema.userSessions.revokedAt),
          gt(this.databaseService.schema.userSessions.expiresAt, now),
        ),
      );

    return rows;
  }
}
