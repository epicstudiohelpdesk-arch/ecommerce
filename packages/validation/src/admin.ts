import { z } from 'zod';
import { paginationQuerySchema } from './common.js';

export const adminOrderQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  orderStatus: z
    .enum(['PLACED', 'PROCESSING', 'PARTIALLY_SHIPPED', 'COMPLETED', 'CANCELLED'])
    .optional(),
  paymentStatus: z.enum(['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

export const adminShipmentQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z
    .enum([
      'LABEL_CREATED',
      'PICKUP_SCHEDULED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERY_FAILED',
      'DELIVERED',
      'RTO_INITIATED',
      'RTO_DELIVERED',
      'CANCELLED',
    ])
    .optional(),
  carrier: z.string().trim().max(50).optional(),
  hasException: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export type AdminShipmentQuery = z.infer<typeof adminShipmentQuerySchema>;

export const adminAuditQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  actorId: z.string().uuid().optional(),
  actorRole: z.string().trim().max(50).optional(),
  action: z.string().trim().max(100).optional(),
  resourceType: z.string().trim().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;

export const staffRoleEnum = z.enum([
  'MARKETPLACE_MANAGER',
  'FINANCE_CONTROLLER',
  'TRUST_SAFETY',
  'CUSTOMER_SUPPORT',
  'READ_ONLY_ANALYST',
  'SUPER_ADMIN',
]);

export type StaffRole = z.infer<typeof staffRoleEnum>;

export const adminStaffQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  role: staffRoleEnum.optional(),
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
});

export type AdminStaffQuery = z.infer<typeof adminStaffQuerySchema>;

export const createStaffUserSchema = z.object({
  email: z.string().trim().email().max(255),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  role: staffRoleEnum,
});

export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;

export const updateStaffStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  reason: z.string().trim().min(3).max(500),
});

export type UpdateStaffStatusInput = z.infer<typeof updateStaffStatusSchema>;
