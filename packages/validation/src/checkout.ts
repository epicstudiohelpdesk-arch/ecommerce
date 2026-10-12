import { z } from 'zod';
import { uuidSchema } from './common.js';

/**
 * Validation schema for Indian postal code (PIN code):
 * 6 digits, first digit cannot be 0.
 */
export const indianPinCodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]{5}$/, {
    message: 'Invalid Indian PIN code. Must be a 6-digit number not starting with 0.',
  });

/**
 * Validation schema for Indian mobile numbers:
 * 10 digits starting with 6, 7, 8, or 9 (with optional +91 prefix).
 */
export const indianPhoneNumberSchema = z
  .string()
  .trim()
  .regex(/^(\+91[\-\s]?)?[6789]\d{9}$/, {
    message: 'Invalid Indian phone number. Expected 10 digits starting with 6, 7, 8, or 9.',
  });

export const deliveryAddressSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, { message: 'Recipient name must be at least 2 characters' })
    .max(150),
  phone: indianPhoneNumberSchema,
  addressLine1: z
    .string()
    .trim()
    .min(5, { message: 'Address line 1 must be at least 5 characters' })
    .max(255),
  addressLine2: z.string().trim().max(255).optional().nullable(),
  locality: z.string().trim().max(150).optional().nullable(),
  city: z.string().trim().min(2, { message: 'City is required' }).max(100),
  state: z.string().trim().min(2, { message: 'State is required' }).max(100),
  postalCode: indianPinCodeSchema,
  country: z.string().trim().length(2).default('IN'),
  deliveryInstructions: z.string().trim().max(500).optional().nullable(),
  isDefault: z.boolean().default(false),
});

export type DeliveryAddressInput = z.infer<typeof deliveryAddressSchema>;

export const checkoutQuoteQuerySchema = z.object({
  shippingAddressId: uuidSchema.optional(),
  addressInput: deliveryAddressSchema.optional(),
  couponCode: z.string().trim().max(50).optional(),
});

export type CheckoutQuoteQueryInput = z.infer<typeof checkoutQuoteQuerySchema>;

export const createCheckoutSessionSchema = z.object({
  shippingAddressId: uuidSchema.optional(),
  addressInput: deliveryAddressSchema.optional(),
  couponCode: z.string().trim().max(50).optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

export const confirmCheckoutSchema = z.object({
  checkoutSessionId: z.string().trim().min(10).max(100),
  customerNote: z.string().trim().max(500).optional(),
});

export type ConfirmCheckoutInput = z.infer<typeof confirmCheckoutSchema>;
