import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import type { JwtTokenPayload } from '@repo/api-contracts';

@Injectable()
export class TokenService {
  private readonly jwtSecret: string;

  constructor(private readonly jwtService: JwtService) {
    this.jwtSecret =
      process.env['JWT_SECRET'] ||
      'dev-insecure-secret-handcrafted-marketplace-change-in-production-1234567890';
  }

  /**
   * Generates a cryptographically random refresh token.
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Computes a deterministic SHA-256 hash of a refresh token for safe storage.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Signs an access token with short lifetime (15 minutes).
   */
  signAccessToken(payload: Omit<JwtTokenPayload, 'type'>): string {
    return this.jwtService.sign(
      { ...payload, type: 'access' },
      {
        secret: this.jwtSecret,
        expiresIn: '15m',
      },
    );
  }

  /**
   * Signs an email verification token with 24-hour lifetime.
   */
  signEmailVerificationToken(userId: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, email, type: 'verify_email' },
      {
        secret: this.jwtSecret,
        expiresIn: '24h',
      },
    );
  }

  /**
   * Signs a password reset token with 15-minute lifetime tied to the current password hash fingerprint.
   */
  signPasswordResetToken(userId: string, email: string, passwordHash: string): string {
    const pwdFingerprint = crypto
      .createHash('sha256')
      .update(passwordHash)
      .digest('hex')
      .substring(0, 16);

    return this.jwtService.sign(
      { sub: userId, email, pwdFingerprint, type: 'password_reset' },
      {
        secret: this.jwtSecret,
        expiresIn: '15m',
      },
    );
  }

  /**
   * Signs a short-lived temporary ticket for the MFA second-factor challenge step.
   */
  signMfaTicket(userId: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, email, type: 'mfa_ticket' },
      {
        secret: this.jwtSecret,
        expiresIn: '5m',
      },
    );
  }

  /**
   * Verifies and decodes any signed token. Throws UnauthorizedException on tamper/expiry.
   */
  verifyToken<T extends object = JwtTokenPayload>(token: string): T {
    try {
      return this.jwtService.verify<T>(token, { secret: this.jwtSecret });
    } catch {
      throw new UnauthorizedException('Token is invalid or has expired');
    }
  }
}
