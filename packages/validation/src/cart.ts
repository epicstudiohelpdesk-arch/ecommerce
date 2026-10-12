import { z } from 'zod';
import { uuidSchema } from './common.js';

export const addToCartSchema = z.object({
  variantId: uuidSchema,
  quantity: z
    .number()
    .int()
    .min(1, { message: 'Quantity must be at least 1' })
    .max(50, { message: 'Maximum quantity per cart item is 50' })
    .default(1),
  customizationText: z.string().trim().max(500).optional(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export const updateCartItemQuantitySchema = z.object({
  quantity: z
    .number()
    .int()
    .min(1, { message: 'Quantity must be at least 1' })
    .max(50, { message: 'Maximum quantity per cart item is 50' }),
  customizationText: z.string().trim().max(500).optional(),
});

export type UpdateCartItemQuantityInput = z.infer<typeof updateCartItemQuantitySchema>;

export const mergeCartSchema = z.object({
  guestSessionId: z
    .string()
    .trim()
    .min(10, { message: 'Guest session ID must be at least 10 characters' })
    .max(100),
});

export type MergeCartInput = z.infer<typeof mergeCartSchema>;
