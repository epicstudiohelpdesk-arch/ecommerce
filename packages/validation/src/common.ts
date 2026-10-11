import { z } from 'zod';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, SUPPORTED_CURRENCIES } from '@repo/shared';

export const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Must be a valid email address' });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const currencyCodeSchema = z.enum(SUPPORTED_CURRENCIES);

export const positiveMinorMoneySchema = z
  .number()
  .int({ message: 'Money minor units must be an integer' })
  .nonnegative({ message: 'Money cannot be negative' });
