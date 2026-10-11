import { describe, expect, it } from 'vitest';
import { formatCurrency, fromMinorUnits, toMinorUnits } from '../src/currency';
import { err, isErr, isOk, ok } from '../src/result';

describe('currency utilities', () => {
  it('converts major units to minor units (cents)', () => {
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(toMinorUnits(0)).toBe(0);
    expect(toMinorUnits(100)).toBe(10000);
  });

  it('converts minor units back to major units', () => {
    expect(fromMinorUnits(1999)).toBe(19.99);
    expect(fromMinorUnits(0)).toBe(0);
    expect(fromMinorUnits(10000)).toBe(100);
  });

  it('rejects invalid inputs to prevent financial errors', () => {
    expect(() => toMinorUnits(NaN)).toThrow(TypeError);
    expect(() => fromMinorUnits(19.99)).toThrow(TypeError);
  });

  it('formats currency correctly', () => {
    const formatted = formatCurrency(1999, 'USD', 'en-US');
    expect(formatted).toBe('$19.99');
  });
});

describe('result monad', () => {
  it('handles ok variant', () => {
    const res = ok(42);
    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
    if (isOk(res)) {
      expect(res.value).toBe(42);
    }
  });

  it('handles err variant', () => {
    const res = err(new Error('failed'));
    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
    if (isErr(res)) {
      expect(res.error.message).toBe('failed');
    }
  });
});
