import { describe, it, expect } from 'vitest';
import {
  addToCartSchema,
  updateCartItemQuantitySchema,
  mergeCartSchema,
  deliveryAddressSchema,
  confirmCheckoutSchema,
} from '../src/index.js';

describe('Cart & Checkout Validation Schemas', () => {
  describe('addToCartSchema', () => {
    it('accepts valid cart item input', () => {
      const valid = {
        variantId: '807b4d34-4bca-4822-84d7-745cb1d3694f',
        quantity: 2,
        customizationText: 'Engrave name: Indira',
      };
      const result = addToCartSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects 0 or negative quantity', () => {
      const invalid = {
        variantId: '807b4d34-4bca-4822-84d7-745cb1d3694f',
        quantity: 0,
      };
      const result = addToCartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects excessively large quantity (>50)', () => {
      const invalid = {
        variantId: '807b4d34-4bca-4822-84d7-745cb1d3694f',
        quantity: 51,
      };
      const result = addToCartSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('deliveryAddressSchema', () => {
    it('accepts valid Indian delivery address', () => {
      const valid = {
        recipientName: 'Ananya Roy',
        phone: '+919876543210',
        addressLine1: 'Flat 402, Shanti Niketan Apartments',
        city: 'Kolkata',
        state: 'West Bengal',
        postalCode: '700019',
        country: 'IN',
        isDefault: true,
      };
      const result = deliveryAddressSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid PIN code starting with 0', () => {
      const invalid = {
        recipientName: 'Ananya Roy',
        phone: '9876543210',
        addressLine1: 'Flat 402, Shanti Niketan Apartments',
        city: 'Kolkata',
        state: 'West Bengal',
        postalCode: '012345',
      };
      const result = deliveryAddressSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid phone number with too few digits', () => {
      const invalid = {
        recipientName: 'Ananya Roy',
        phone: '12345',
        addressLine1: 'Flat 402, Shanti Niketan Apartments',
        city: 'Kolkata',
        state: 'West Bengal',
        postalCode: '700019',
      };
      const result = deliveryAddressSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('confirmCheckoutSchema', () => {
    it('validates checkout confirmation input', () => {
      const valid = {
        checkoutSessionId: 'chk_sess_982347293847',
        customerNote: 'Please ring bell upon delivery.',
      };
      const result = confirmCheckoutSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('updateCartItemQuantitySchema', () => {
    it('accepts valid quantity update', () => {
      const valid = { quantity: 5, customizationText: 'Update' };
      const result = updateCartItemQuantitySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects zero or negative quantity', () => {
      const invalid = { quantity: 0 };
      const result = updateCartItemQuantitySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('mergeCartSchema', () => {
    it('accepts valid guest session id', () => {
      const valid = { guestSessionId: 'sess_1234567890_abcdef' };
      const result = mergeCartSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});
