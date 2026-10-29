// ==========================================
// 1. SUPPORT TICKETS CONTRACTS
// ==========================================

export interface SupportTicketListItemDto {
  id: string;
  ticketNumber: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  orderNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketMessageDto {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  isInternal: boolean;
  attachments: Record<string, unknown>[];
  createdAt: string;
}

export interface SupportTicketDetailDto {
  id: string;
  ticketNumber: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  subOrderId?: string | null;
  subOrderNumber?: string | null;
  productId?: string | null;
  productTitle?: string | null;
  escalated: boolean;
  escalationReason?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessageDto[];
}

export interface PaginatedSupportTicketsDto {
  tickets: SupportTicketListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==========================================
// 2. DISPUTES CONTRACTS
// ==========================================

export interface DisputeListItemDto {
  id: string;
  disputeNumber: string;
  subOrderId: string;
  subOrderNumber: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  shopName: string;
  reason: string;
  claimedAmountMinor: number;
  currency: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
}

export interface DisputeDetailDto {
  id: string;
  disputeNumber: string;
  subOrderId: string;
  subOrderNumber: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  shopName: string;
  reason: string;
  claimedAmountMinor: number;
  currency: string;
  status: string;
  resolution?: string | null;
  customerNotes?: string | null;
  sellerNotes?: string | null;
  evidenceUrls: string[];
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedDisputesDto {
  disputes: DisputeListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==========================================
// 3. POLICY REPORTS CONTRACTS
// ==========================================

export interface PolicyReportListItemDto {
  id: string;
  reportNumber: string;
  reporterId?: string | null;
  reporterName?: string | null;
  targetType: string;
  targetId: string;
  targetTitle?: string | null;
  reason: string;
  status: string;
  actionTaken: string;
  createdAt: string;
}

export interface PolicyReportDetailDto {
  id: string;
  reportNumber: string;
  reporterId?: string | null;
  reporterName?: string | null;
  targetType: string;
  targetId: string;
  targetTitle?: string | null;
  reason: string;
  description: string;
  evidenceUrls: string[];
  status: string;
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
  reviewNotes?: string | null;
  actionTaken: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPolicyReportsDto {
  reports: PolicyReportListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==========================================
// 4. RISK CASES CONTRACTS
// ==========================================

export interface RiskCaseListItemDto {
  id: string;
  caseNumber: string;
  entityType: string;
  entityId: string;
  signalType: string;
  riskLevel: string;
  status: string;
  actionTaken: string;
  createdAt: string;
}

export interface RiskCaseDetailDto {
  id: string;
  caseNumber: string;
  entityType: string;
  entityId: string;
  signalType: string;
  riskLevel: string;
  status: string;
  assignedInvestigatorId?: string | null;
  assignedInvestigatorName?: string | null;
  evidenceSnapshot?: Record<string, unknown> | null;
  internalNotes?: string | null;
  actionTaken: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRiskCasesDto {
  cases: RiskCaseListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==========================================
// 5. PRIVACY & COMPLIANCE CONTRACTS
// ==========================================

export interface PrivacyRequestListItemDto {
  id: string;
  requestNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  requestType: string;
  status: string;
  createdAt: string;
}

export interface PrivacyRequestDetailDto {
  id: string;
  requestNumber: string;
  userId: string;
  userName: string;
  userEmail: string;
  requestType: string;
  status: string;
  reason?: string | null;
  reviewNotes?: string | null;
  retentionExemptions?: string | null;
  assignedTo?: string | null;
  assignedStaffName?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPrivacyRequestsDto {
  requests: PrivacyRequestListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
