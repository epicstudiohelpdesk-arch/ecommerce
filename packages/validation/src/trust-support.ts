import { z } from 'zod';

// ==========================================
// 1. SUPPORT TICKETS & MESSAGES SCHEMAS
// ==========================================

export const supportCategorySchema = z.enum([
  'ORDER_ISSUE',
  'PAYMENT_DISPUTE',
  'SHIPPING_DELAY',
  'SELLER_VERIFICATION',
  'GENERAL_INQUIRY',
]);

export const ticketStatusSchema = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_USER',
  'RESOLVED',
  'CLOSED',
]);

export const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createSupportTicketSchema = z.object({
  category: supportCategorySchema,
  subject: z.string().min(3).max(255),
  description: z.string().min(10).max(5000),
  orderId: z.string().uuid().optional(),
  subOrderId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  priority: ticketPrioritySchema.optional().default('MEDIUM'),
});

export const supportTicketQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: ticketStatusSchema.optional(),
  category: supportCategorySchema.optional(),
  priority: ticketPrioritySchema.optional(),
  unassigned: z
    .union([z.boolean(), z.string().transform((val) => val === 'true')])
    .optional(),
  assignedAgentId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export const createTicketMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  isInternal: z.boolean().optional().default(false),
  attachments: z.array(z.record(z.unknown())).optional().default([]),
});

export const updateTicketStatusSchema = z.object({
  status: ticketStatusSchema,
  resolutionNotes: z.string().max(2000).optional(),
});

export const assignTicketSchema = z.object({
  agentId: z.string().uuid(),
});

export const escalateTicketSchema = z.object({
  reason: z.string().min(5).max(1000),
});

// ==========================================
// 2. DISPUTES SCHEMAS
// ==========================================

export const disputeReasonSchema = z.enum([
  'DAMAGED_HANDMADE_GOOD',
  'NOT_AS_DESCRIBED',
  'NOT_DELIVERED',
  'UNAUTHORIZED_RETURN_REJECTION',
]);

export const disputeStatusSchema = z.enum([
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'CLOSED',
]);

export const disputeResolutionSchema = z.enum([
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'REJECTED',
  'SELLER_FAVORED',
]);

export const createDisputeSchema = z.object({
  subOrderId: z.string().uuid(),
  reason: disputeReasonSchema,
  claimedAmountMinor: z.number().int().positive(),
  customerNotes: z.string().min(10).max(3000),
  evidenceUrls: z.array(z.string().url()).optional().default([]),
});

export const sellerDisputeResponseSchema = z.object({
  sellerNotes: z.string().min(5).max(3000),
  evidenceUrls: z.array(z.string().url()).optional().default([]),
});

export const resolveDisputeSchema = z.object({
  resolution: disputeResolutionSchema,
  resolutionNotes: z.string().min(5).max(2000),
  refundAmountMinor: z.number().int().positive().optional(),
});

export const disputeQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: disputeStatusSchema.optional(),
  reason: disputeReasonSchema.optional(),
});

// ==========================================
// 3. POLICY REPORTS SCHEMAS
// ==========================================

export const policyTargetTypeSchema = z.enum(['PRODUCT', 'SELLER', 'REVIEW']);

export const policyReportReasonSchema = z.enum([
  'MISLEADING_INFO',
  'NOT_HANDMADE',
  'PROHIBITED_ITEM',
  'COPYRIGHT_INFRINGEMENT',
  'ABUSIVE_BEHAVIOR',
  'OTHER',
]);

export const policyReportStatusSchema = z.enum([
  'PENDING_REVIEW',
  'INVESTIGATING',
  'ACTION_TAKEN',
  'DISMISSED',
]);

export const policyReportActionSchema = z.enum([
  'NO_ACTION',
  'WARNING_ISSUED',
  'LISTING_REMOVED',
  'SELLER_SUSPENDED',
]);

export const createPolicyReportSchema = z.object({
  targetType: policyTargetTypeSchema,
  targetId: z.string().uuid(),
  reason: policyReportReasonSchema,
  description: z.string().min(10).max(3000),
  evidenceUrls: z.array(z.string().url()).optional().default([]),
});

export const reviewPolicyReportSchema = z.object({
  status: policyReportStatusSchema,
  actionTaken: policyReportActionSchema,
  reviewNotes: z.string().min(5).max(2000),
});

export const policyReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: policyReportStatusSchema.optional(),
  targetType: policyTargetTypeSchema.optional(),
});

// ==========================================
// 4. RISK CASES SCHEMAS
// ==========================================

export const riskEntityTypeSchema = z.enum(['USER', 'ORDER', 'SELLER']);

export const riskSignalTypeSchema = z.enum([
  'VELOCITY_PAYMENT_FAILURE',
  'SUSPICIOUS_CHECKOUT',
  'DUPLICATE_DISPUTES',
  'FULFILMENT_ANOMALY',
  'MANUAL_SECURITY_FLAG',
]);

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const riskCaseStatusSchema = z.enum([
  'OPEN',
  'UNDER_INVESTIGATION',
  'MITIGATED',
  'DISMISSED',
]);

export const riskActionTakenSchema = z.enum([
  'NONE',
  'TRANSACTION_FLAGGED',
  'SELLER_HOLD_REQUESTED',
  'ACCOUNT_RESTRICTED',
]);

export const createRiskCaseSchema = z.object({
  entityType: riskEntityTypeSchema,
  entityId: z.string().uuid(),
  signalType: riskSignalTypeSchema,
  riskLevel: riskLevelSchema.optional().default('MEDIUM'),
  internalNotes: z.string().max(2000).optional(),
  evidenceSnapshot: z.record(z.unknown()).optional(),
});

export const reviewRiskCaseSchema = z.object({
  status: riskCaseStatusSchema,
  actionTaken: riskActionTakenSchema,
  internalNotes: z.string().min(5).max(2000),
});

export const riskCaseQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: riskCaseStatusSchema.optional(),
  riskLevel: riskLevelSchema.optional(),
  entityType: riskEntityTypeSchema.optional(),
});

// ==========================================
// 5. PRIVACY & COMPLIANCE SCHEMAS
// ==========================================

export const privacyRequestTypeSchema = z.enum([
  'DATA_ACCESS',
  'DATA_CORRECTION',
  'ACCOUNT_DELETION',
  'CONSENT_WITHDRAWAL',
]);

export const privacyRequestStatusSchema = z.enum([
  'SUBMITTED',
  'IN_REVIEW',
  'COMPLETED',
  'REJECTED',
]);

export const createPrivacyRequestSchema = z.object({
  requestType: privacyRequestTypeSchema,
  reason: z.string().min(5).max(2000).optional(),
});

export const processPrivacyRequestSchema = z.object({
  status: privacyRequestStatusSchema,
  reviewNotes: z.string().min(5).max(2000),
  retentionExemptions: z.string().max(2000).optional(),
});

export const privacyRequestQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: privacyRequestStatusSchema.optional(),
  requestType: privacyRequestTypeSchema.optional(),
});

// ==========================================
// INFERRED TYPES
// ==========================================

export type SupportCategory = z.infer<typeof supportCategorySchema>;
export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
export type SupportTicketQuery = z.infer<typeof supportTicketQuerySchema>;
export type CreateTicketMessageInput = z.infer<typeof createTicketMessageSchema>;
export type UpdateTicketStatusInput = z.infer<typeof updateTicketStatusSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type EscalateTicketInput = z.infer<typeof escalateTicketSchema>;

export type DisputeReason = z.infer<typeof disputeReasonSchema>;
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;
export type DisputeResolution = z.infer<typeof disputeResolutionSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type SellerDisputeResponseInput = z.infer<typeof sellerDisputeResponseSchema>;
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
export type DisputeQuery = z.infer<typeof disputeQuerySchema>;

export type PolicyTargetType = z.infer<typeof policyTargetTypeSchema>;
export type PolicyReportReason = z.infer<typeof policyReportReasonSchema>;
export type PolicyReportStatus = z.infer<typeof policyReportStatusSchema>;
export type PolicyReportAction = z.infer<typeof policyReportActionSchema>;
export type CreatePolicyReportInput = z.infer<typeof createPolicyReportSchema>;
export type ReviewPolicyReportInput = z.infer<typeof reviewPolicyReportSchema>;
export type PolicyReportQuery = z.infer<typeof policyReportQuerySchema>;

export type RiskEntityType = z.infer<typeof riskEntityTypeSchema>;
export type RiskSignalType = z.infer<typeof riskSignalTypeSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type RiskCaseStatus = z.infer<typeof riskCaseStatusSchema>;
export type RiskActionTaken = z.infer<typeof riskActionTakenSchema>;
export type CreateRiskCaseInput = z.infer<typeof createRiskCaseSchema>;
export type ReviewRiskCaseInput = z.infer<typeof reviewRiskCaseSchema>;
export type RiskCaseQuery = z.infer<typeof riskCaseQuerySchema>;

export type PrivacyRequestType = z.infer<typeof privacyRequestTypeSchema>;
export type PrivacyRequestStatus = z.infer<typeof privacyRequestStatusSchema>;
export type CreatePrivacyRequestInput = z.infer<typeof createPrivacyRequestSchema>;
export type ProcessPrivacyRequestInput = z.infer<typeof processPrivacyRequestSchema>;
export type PrivacyRequestQuery = z.infer<typeof privacyRequestQuerySchema>;
