import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, passwordSchema } from '../src/auth.js';

describe('Auth Validation Schemas', () => {
  it('validates robust password complexity', () => {
    // Too short
    expect(passwordSchema.safeParse('Weak1!').success).toBe(false);
    // No number
    expect(passwordSchema.safeParse('NoNumberPassword!').success).toBe(false);
    // No special char
    expect(passwordSchema.safeParse('NoSpecialChar12345').success).toBe(false);
    // Valid password
    expect(passwordSchema.safeParse('ArtisanPassw0rd!#').success).toBe(true);
  });

  it('validates register inputs correctly', () => {
    const valid = {
      email: 'Artisan.Indira@Example.com ',
      password: 'StrongPassword123!',
      fullName: 'Indira Sharma',
      phone: '+919876543210',
    };
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('artisan.indira@example.com');
    }
  });

  it('rejects invalid login inputs', () => {
    expect(loginSchema.safeParse({ email: 'bad-email', password: '' }).success).toBe(false);
  });
});
