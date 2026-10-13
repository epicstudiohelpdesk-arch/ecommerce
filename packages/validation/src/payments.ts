import { z } from 'zod';

export const PaymentProviderEnum = z.enum(['RAZORPAY', 'STRIPE', 'MOCK_PROVIDER']);
export type PaymentProvider = z.infer<typeof PaymentProviderEnum>;

export const PaymentAttemptStatusEnum = z.enum([
  'INITIATED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);
export type PaymentAttemptStatus = z.infer<typeof PaymentAttemptStatusEnum>;

export const RefundReasonEnum = z.enum([
  'CUSTOMER_CANCELLATION',
  'DEFECTIVE_ITEM',
  'ITEM_NOT_RECEIVED',
  'SELLER_UNFULFILLED',
  'DISPUTE_RESOLUTION',
]);
export type RefundReason = z.infer<typeof RefundReasonEnum>;

export const RefundStatusEnum = z.enum([
  'REQUESTED',
  'APPROVED',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
]);
export type RefundStatus = z.infer<typeof RefundStatusEnum>;

export const InitiatePaymentSchema = z
  .object({
    orderId: z.string().uuid().optional(),
    orderNumber: z.string().min(1).optional(),
    provider: PaymentProviderEnum.default('RAZORPAY'),
    idempotencyKey: z.string().max(255).optional(),
  })
  .refine((data) => data.orderId || data.orderNumber, {
    message: 'Either orderId or orderNumber must be provided',
    path: ['orderId'],
  });

export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;

export const VerifyPaymentSchema = z.object({
  orderNumber: z.string().min(1),
  paymentAttemptId: z.string().uuid().optional(),
  providerPaymentId: z.string().min(1),
  providerOrderId: z.string().min(1),
  providerSignature: z.string().min(1),
});

export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;

export const RefundRequestSchema = z.object({
  subOrderId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  reason: RefundReasonEnum,
  notes: z.string().max(500).optional(),
});

export type RefundRequestInput = z.infer<typeof RefundRequestSchema>;

export const ProcessRefundSchema = z.object({
  approved: z.boolean(),
  rejectionReason: z.string().max(500).optional(),
});

export type ProcessRefundInput = z.infer<typeof ProcessRefundSchema>;

export const ReconciliationQuerySchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  includeStale: z.boolean().default(true),
});

export type ReconciliationQueryInput = z.infer<typeof ReconciliationQuerySchema>;
