export interface CreatePaymentIntentParams {
  orderNumber: string;
  amountMinor: number;
  currency: string;
  customer: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
  };
  notes?: Record<string, string>;
  receipt?: string;
}

export interface PaymentIntentResult {
  providerIntentId: string;
  clientSecret?: string;
  amountMinor: number;
  currency: string;
  keyId: string;
  rawResponse?: Record<string, unknown>;
}

export interface PaymentDetailsResult {
  providerPaymentId: string;
  providerIntentId: string;
  amountMinor: number;
  currency: string;
  status: 'captured' | 'failed' | 'pending' | 'authorized' | 'refunded';
  method?: string;
  rawResponse?: Record<string, unknown>;
}

export interface CreateRefundParams {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  reason: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RefundResult {
  providerRefundId: string;
  amountMinor: number;
  currency: string;
  status: 'pending' | 'processed' | 'failed';
  rawResponse?: Record<string, unknown>;
}

export interface IPaymentProvider {
  readonly providerName: 'RAZORPAY' | 'STRIPE' | 'MOCK_PROVIDER';
  readonly keyId: string;

  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean;

  verifyCheckoutSignature?(params: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
    secret?: string;
  }): boolean;

  fetchPaymentDetails(providerPaymentId: string): Promise<PaymentDetailsResult>;

  createRefund(params: CreateRefundParams): Promise<RefundResult>;
}
