export interface PaymentInitiationCustomerDetails {
  name: string;
  email: string;
  phone?: string | null;
}

export interface PaymentInitiationResultDto {
  paymentAttemptId: string;
  orderId: string;
  orderNumber: string;
  provider: 'RAZORPAY' | 'STRIPE' | 'MOCK_PROVIDER';
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  keyId: string;
  customer: PaymentInitiationCustomerDetails;
  status: string;
}

export interface PaymentVerificationResultDto {
  orderNumber: string;
  paymentStatus: 'PAID' | 'FAILED' | 'PENDING';
  orderStatus: 'PROCESSING' | 'PLACED' | 'FAILED';
  paymentAttemptId: string;
  providerPaymentId: string;
  capturedAt: string;
}

export interface PaymentAttemptSummaryDto {
  id: string;
  provider: string;
  providerIntentId: string;
  amountMinor: number;
  currency: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface PaymentStatusDto {
  orderNumber: string;
  paymentStatus: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
  orderStatus: 'PLACED' | 'PROCESSING' | 'PARTIALLY_SHIPPED' | 'COMPLETED' | 'CANCELLED';
  totalAmountMinor: number;
  currency: string;
  attempts: PaymentAttemptSummaryDto[];
  canRetry: boolean;
}

export interface SellerBalanceStatementDto {
  sellerId: string;
  currency: string;
  availablePayoutMinor: number;
  pendingEscrowMinor: number;
  heldDisputeMinor: number;
  lifetimePayoutMinor: number;
  updatedAt: string;
}

export interface LedgerEntryDto {
  id: string;
  journalBatchId: string;
  accountCode: string;
  accountName: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountMinor: number;
  currency: string;
  description: string;
  sellerId?: string | null;
  subOrderId?: string | null;
  postedAt: string;
}

export interface RefundDto {
  id: string;
  refundNumber: string;
  subOrderId: string;
  paymentAttemptId: string;
  amountMinor: number;
  currency: string;
  reason: string;
  status: string;
  providerRefundId?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationDiscrepancyDto {
  type: string;
  entityId: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, unknown>;
}

export interface ReconciliationReportDto {
  generatedAt: string;
  totalAttemptsChecked: number;
  stalePendingCount: number;
  amountMismatchCount: number;
  unprocessedWebhooksCount: number;
  unbalancedBatchesCount: number;
  discrepancies: ReconciliationDiscrepancyDto[];
  isHealthy: boolean;
}
