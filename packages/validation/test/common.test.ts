import { describe, expect, it } from 'vitest';
import { emailSchema, paginationQuerySchema, uuidSchema } from '../src/common';

describe('validation schemas', () => {
  it('validates UUIDs correctly', () => {
    const valid = '123e4567-e89b-12d3-a456-426614174000';
    expect(uuidSchema.safeParse(valid).success).toBe(true);
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });

  it('normalizes and validates emails', () => {
    const parsed = emailSchema.parse(' ARTISAN@Shop.Local ');
    expect(parsed).toBe('artisan@shop.local');
    expect(emailSchema.safeParse('invalid-email').success).toBe(false);
  });

  it('applies pagination defaults and limits', () => {
    const defaulted = paginationQuerySchema.parse({});
    expect(defaulted.page).toBe(1);
    expect(defaulted.limit).toBe(20);

    const coerced = paginationQuerySchema.parse({ page: '2', limit: '50' });
    expect(coerced.page).toBe(2);
    expect(coerced.limit).toBe(50);

    expect(paginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});
