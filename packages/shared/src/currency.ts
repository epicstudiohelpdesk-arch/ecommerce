/**
 * Integer-based currency calculations to avoid floating-point inaccuracies.
 * All monetary amounts in database and ledger are stored as integer minor units (e.g. cents, paise).
 */

export function toMinorUnits(majorUnits: number): number {
  if (!Number.isFinite(majorUnits)) {
    throw new TypeError('Currency amount must be a finite number');
  }
  return Math.round(majorUnits * 100);
}

export function fromMinorUnits(minorUnits: number): number {
  if (!Number.isInteger(minorUnits)) {
    throw new TypeError('Minor currency units must be an integer');
  }
  return minorUnits / 100;
}

export function formatCurrency(
  minorUnits: number,
  currency: string = 'USD',
  locale: string = 'en-US',
): string {
  const major = fromMinorUnits(minorUnits);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(major);
}
