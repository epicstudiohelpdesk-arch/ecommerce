import { Injectable } from '@nestjs/common';
import * as otplib from 'otplib';
import * as crypto from 'node:crypto';

@Injectable()
export class MfaService {
  private readonly issuer = 'HandcraftedMarketplace';

  /**
   * Generates a random Base32 TOTP secret.
   */
  generateSecret(): string {
    return otplib.generateSecret();
  }

  /**
   * Generates standard otpauth:// URI for authenticator apps.
   */
  generateUri(email: string, secret: string): string {
    return otplib.generateURI({
      secret,
      label: email,
      issuer: this.issuer,
    });
  }

  /**
   * Validates a 6-digit TOTP code against a secret.
   */
  verifyCode(code: string, secret: string): boolean {
    try {
      const result = otplib.verifySync({
        secret,
        token: code,
      });
      return result.valid === true;
    } catch {
      return false;
    }
  }

  /**
   * Generates 8 single-use alphanumeric backup recovery codes.
   */
  generateRecoveryCodes(count = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const randomHex = crypto.randomBytes(5).toString('hex').toUpperCase();
      // Format as 5-5 characters: e.g. ABCDE-12345
      codes.push(`${randomHex.substring(0, 5)}-${randomHex.substring(5, 10)}`);
    }
    return codes;
  }
}
