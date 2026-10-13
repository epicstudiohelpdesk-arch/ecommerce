import { Injectable, Logger } from '@nestjs/common';
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
export class RazorpayPaymentProvider implements IPaymentProvider {
  readonly providerName = 'RAZORPAY';
  private readonly logger = new Logger(RazorpayPaymentProvider.name);

  readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    this.keyId = process.env['RAZORPAY_KEY_ID'] || 'rzp_test_marketplace_dev';
    this.keySecret = process.env['RAZORPAY_KEY_SECRET'] || 'rzp_test_secret_dev_key';
    this.webhookSecret = process.env['RAZORPAY_WEBHOOK_SECRET'] || 'rzp_webhook_secret_dev_key';
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const { orderNumber, amountMinor, currency, notes } = params;

    // In a live production environment with real keys:
    // If not standard test mock keys, make the Razorpay API call
    const isLiveKey = this.keyId.startsWith('rzp_live_');
    if (isLiveKey) {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: amountMinor,
          currency,
          receipt: orderNumber,
          notes: notes ?? {},
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        this.logger.error(`Razorpay order creation failed: ${res.status} - ${errorBody}`);
        throw new Error(`Razorpay gateway order creation failed: ${res.statusText}`);
      }

      const data = (await res.json()) as { id: string; amount: number; currency: string };
      return {
        providerIntentId: data.id,
        amountMinor: data.amount,
        currency: data.currency,
        keyId: this.keyId,
        rawResponse: data,
      };
    }

    // Authoritative deterministic test/sandbox creation matching Razorpay standard format
    const providerIntentId = `order_${randomBytes(10).toString('hex')}`;
    return {
      providerIntentId,
      amountMinor,
      currency,
      keyId: this.keyId,
      rawResponse: {
        id: providerIntentId,
        entity: 'order',
        amount: amountMinor,
        currency,
        receipt: orderNumber,
        status: 'created',
      },
    };
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret?: string): boolean {
    const effectiveSecret = secret || this.webhookSecret;
    if (!effectiveSecret || !signature) {
      return false;
    }

    try {
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const expectedSignature = createHmac('sha256', effectiveSecret)
        .update(bodyBuffer)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (err) {
      this.logger.error('Error verifying Razorpay webhook signature', err);
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
    const effectiveSecret = secret || this.keySecret;
    if (!effectiveSecret || !signature) {
      return false;
    }

    try {
      const payload = `${providerOrderId}|${providerPaymentId}`;
      const expectedSignature = createHmac('sha256', effectiveSecret).update(payload).digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(signature, 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return timingSafeEqual(expectedBuffer, actualBuffer);
    } catch (err) {
      this.logger.error('Error verifying Razorpay checkout signature', err);
      return false;
    }
  }

  async fetchPaymentDetails(providerPaymentId: string): Promise<PaymentDetailsResult> {
    const isLiveKey = this.keyId.startsWith('rzp_live_');
    if (isLiveKey) {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!res.ok) {
        throw new Error(`Razorpay fetch payment failed: ${res.statusText}`);
      }

      const data = (await res.json()) as {
        id: string;
        order_id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
      };

      return {
        providerPaymentId: data.id,
        providerIntentId: data.order_id,
        amountMinor: data.amount,
        currency: data.currency,
        status: data.status === 'captured' ? 'captured' : 'pending',
        method: data.method,
        rawResponse: data,
      };
    }

    // Sandbox / Test fallback
    return {
      providerPaymentId,
      providerIntentId: `order_${randomBytes(10).toString('hex')}`,
      amountMinor: 100000,
      currency: 'INR',
      status: 'captured',
      method: 'upi',
    };
  }

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const { providerPaymentId, amountMinor, notes } = params;
    const isLiveKey = this.keyId.startsWith('rzp_live_');
    if (isLiveKey) {
      const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
      const res = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          amount: amountMinor,
          notes: notes ?? {},
        }),
      });

      if (!res.ok) {
        throw new Error(`Razorpay refund failed: ${res.statusText}`);
      }

      const data = (await res.json()) as {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };
      return {
        providerRefundId: data.id,
        amountMinor: data.amount,
        currency: data.currency,
        status: data.status === 'processed' ? 'processed' : 'pending',
        rawResponse: data,
      };
    }

    const providerRefundId = `rfnd_${randomBytes(10).toString('hex')}`;
    return {
      providerRefundId,
      amountMinor,
      currency: params.currency,
      status: 'processed',
      rawResponse: { id: providerRefundId, amount: amountMinor, status: 'processed' },
    };
  }
}
