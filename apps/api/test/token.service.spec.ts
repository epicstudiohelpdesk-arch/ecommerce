import { describe, it, expect } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from '../src/modules/auth/token.service';

describe('TokenService (JWT & Cryptographic Primitives)', () => {
  const jwtService = new JwtService();
  const tokenService = new TokenService(jwtService);

  it('generates unique cryptographic refresh tokens', () => {
    const t1 = tokenService.generateRefreshToken();
    const t2 = tokenService.generateRefreshToken();

    expect(t1).toHaveLength(64);
    expect(t2).toHaveLength(64);
    expect(t1).not.toBe(t2);
  });

  it('computes deterministic SHA-256 hashes of tokens', () => {
    const raw = 'artisan_raw_refresh_token_12345';
    const h1 = tokenService.hashToken(raw);
    const h2 = tokenService.hashToken(raw);

    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(tokenService.hashToken('different_token')).not.toBe(h1);
  });

  it('signs and verifies valid access tokens', () => {
    const token = tokenService.signAccessToken({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'indira@example.test',
      roles: ['CUSTOMER'],
      sessionId: '00000000-0000-0000-0000-000000000002',
    });

    const payload = tokenService.verifyToken(token);
    expect(payload.sub).toBe('00000000-0000-0000-0000-000000000001');
    expect(payload.email).toBe('indira@example.test');
    expect(payload.type).toBe('access');
  });

  it('signs and verifies email verification tokens', () => {
    const token = tokenService.signEmailVerificationToken(
      '00000000-0000-0000-0000-000000000001',
      'indira@example.test',
    );

    const payload = tokenService.verifyToken(token);
    expect(payload.sub).toBe('00000000-0000-0000-0000-000000000001');
    expect(payload.type).toBe('verify_email');
  });

  it('signs password reset token with fingerprint protection', () => {
    const pwdHash = '$argon2id$v=19$m=65536,t=3,p=4$somehashvalue';
    const token = tokenService.signPasswordResetToken(
      '00000000-0000-0000-0000-000000000001',
      'indira@example.test',
      pwdHash,
    );

    const payload = tokenService.verifyToken<{
      sub: string;
      email: string;
      pwdFingerprint: string;
      type: string;
    }>(token);

    expect(payload.sub).toBe('00000000-0000-0000-0000-000000000001');
    expect(payload.type).toBe('password_reset');
    expect(payload.pwdFingerprint).toHaveLength(16);
  });

  it('rejects tampered tokens with UnauthorizedException', () => {
    const token = tokenService.signAccessToken({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'indira@example.test',
      roles: ['CUSTOMER'],
    });

    const tampered = token + 'tampered';
    expect(() => tokenService.verifyToken(tampered)).toThrowError(
      'Token is invalid or has expired',
    );
  });
});
