import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import type {
  IPaymentProvider,
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentDetailsResult,
  CreateRefundParams,
  RefundResult,
} from '../interfaces/payment-provider.interface';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  readonly providerName = 'MOCK_PROVIDER';
  readonly keyId = 'mock_key_test';
  private readonly secretKey = 'mock_payment_secret_for_tests';

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const providerIntentId = `mock_intent_${randomBytes(8).toString('hex')}`;
    return {
      providerIntentId,
      amountMinor: params.amountMinor,
      currency: params.currency,
      keyId: 'mock_key_test',
      clientSecret: `mock_client_secret_${providerIntentId}`,
      rawResponse: { id: providerIntentId, amount: params.amountMinor, status: 'created' },
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean {
    const effectiveSecret = secret || this.secretKey;
    if (!effectiveSecret || !signature) return false;

    try {
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const expected = createHmac('sha256', effectiveSecret).update(bodyBuffer).digest('hex');
      const expectedBuffer = Buffer.from(expected, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) return false;
      return timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  verifyCheckoutSignature(params: {
    providerOrderId: string;
    providerPaymentId: string;
    signature: string;
    secret?: string;
  }): boolean {
    const { providerOrderId, providerPaymentId, signature, secret } = params;
    const effectiveSecret = secret || this.secretKey;
    if (!effectiveSecret || !signature) return false;

    try {
      const payload = `${providerOrderId}|${providerPaymentId}`;
      const expected = createHmac('sha256', effectiveSecret).update(payload).digest('hex');
      const expectedBuffer = Buffer.from(expected, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) return false;
      return timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  async fetchPaymentDetails(providerPaymentId: string): Promise<PaymentDetailsResult> {
    return {
      providerPaymentId,
      providerIntentId: `mock_intent_from_${providerPaymentId}`,
      amountMinor: 100000,
      currency: 'INR',
      status: 'captured',
      method: 'mock_card',
    };
  }

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const providerRefundId = `mock_rfnd_${randomBytes(8).toString('hex')}`;
    return {
      providerRefundId,
      amountMinor: params.amountMinor,
      currency: params.currency,
      status: 'processed',
      rawResponse: { id: providerRefundId, amount: params.amountMinor },
    };
  }
}
