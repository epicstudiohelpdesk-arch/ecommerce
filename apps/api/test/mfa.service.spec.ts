import { describe, it, expect } from 'vitest';
import * as otplib from 'otplib';
import { MfaService } from '../src/modules/auth/mfa.service';

describe('MfaService (TOTP & Recovery Codes)', () => {
  const service = new MfaService();

  it('generates Base32 TOTP secrets', () => {
    const secret = service.generateSecret();
    expect(secret).toBeDefined();
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it('generates standard otpauth URI', () => {
    const secret = service.generateSecret();
    const uri = service.generateUri('artisan@example.test', secret);

    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri.includes('HandcraftedMarketplace')).toBe(true);
    expect(uri.includes(secret)).toBe(true);
  });

  it('verifies valid TOTP tokens generated with matching secret', () => {
    const secret = service.generateSecret();
    const validCode = otplib.generateSync({ secret });

    expect(service.verifyCode(validCode, secret)).toBe(true);
  });

  it('rejects incorrect TOTP tokens', () => {
    const secret = service.generateSecret();
    expect(service.verifyCode('000000', secret)).toBe(false);
  });

  it('generates formatted single-use backup recovery codes', () => {
    const codes = service.generateRecoveryCodes(8);

    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/);
    }
    // All recovery codes must be distinct
    const unique = new Set(codes);
    expect(unique.size).toBe(8);
  });
});
