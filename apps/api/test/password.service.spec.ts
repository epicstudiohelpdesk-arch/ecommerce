import { describe, it, expect } from 'vitest';
import { PasswordService } from '../src/modules/auth/password.service';

describe('PasswordService (Argon2id)', () => {
  const service = new PasswordService();

  it('hashes passwords using Argon2id format', async () => {
    const plaintext = 'ArtisanP@ssw0rd2026!';
    const hash = await service.hash(plaintext);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('successfully verifies a valid password', async () => {
    const plaintext = 'ArtisanP@ssw0rd2026!';
    const hash = await service.hash(plaintext);

    const isValid = await service.verify(hash, plaintext);
    expect(isValid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const plaintext = 'ArtisanP@ssw0rd2026!';
    const hash = await service.hash(plaintext);

    const isValid = await service.verify(hash, 'WrongPassword123!');
    expect(isValid).toBe(false);
  });

  it('handles malformed hash gracefully without throwing', async () => {
    const isValid = await service.verify('invalid-hash-string', 'AnyPassword');
    expect(isValid).toBe(false);
  });
});
