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
export class StripePaymentProvider implements IPaymentProvider {
  readonly providerName = 'STRIPE';
  private readonly logger = new Logger(StripePaymentProvider.name);

  readonly keyId: string;
  private readonly publishableKey: string;
  private readonly secretKey: string;
  private readonly webhookSecret: string;

  constructor() {
    this.publishableKey = process.env['STRIPE_PUBLISHABLE_KEY'] || 'pk_test_stripe_marketplace_dev';
    this.keyId = this.publishableKey;
    this.secretKey = process.env['STRIPE_SECRET_KEY'] || 'sk_test_stripe_dev_secret';
    this.webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'] || 'whsec_stripe_dev_secret';
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    const { orderNumber, amountMinor, currency, customer, notes } = params;

    const isLive = this.secretKey.startsWith('sk_live_');
    if (isLive) {
      const body = new URLSearchParams();
      body.append('amount', amountMinor.toString());
      body.append('currency', currency.toLowerCase());
      body.append('metadata[orderNumber]', orderNumber);
      body.append('metadata[customerId]', customer.id);
      if (notes) {
        for (const [k, v] of Object.entries(notes)) {
          body.append(`metadata[${k}]`, v);
        }
      }

      const res = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Stripe payment intent creation failed: ${res.status} - ${errorText}`);
        throw new Error(`Stripe payment intent creation failed: ${res.statusText}`);
      }

      const data = (await res.json()) as {
        id: string;
        client_secret: string;
        amount: number;
        currency: string;
      };
      return {
        providerIntentId: data.id,
        clientSecret: data.client_secret,
        amountMinor: data.amount,
        currency: data.currency.toUpperCase(),
        keyId: this.publishableKey,
        rawResponse: data,
      };
    }

    const providerIntentId = `pi_${randomBytes(12).toString('hex')}`;
    const clientSecret = `${providerIntentId}_secret_${randomBytes(8).toString('hex')}`;
    return {
      providerIntentId,
      clientSecret,
      amountMinor,
      currency,
      keyId: this.publishableKey,
      rawResponse: {
        id: providerIntentId,
        client_secret: clientSecret,
        amount: amountMinor,
        currency: currency.toLowerCase(),
        status: 'requires_payment_method',
      },
    };
  }

  verifyWebhookSignature(
    rawBody: string | Buffer,
    signatureHeader: string,
    secret?: string,
  ): boolean {
    const effectiveSecret = secret || this.webhookSecret;
    if (!effectiveSecret || !signatureHeader) {
      return false;
    }

    try {
      // Stripe signature format: t=1492774577,v1=5257a869e7ecebeda32affa62cd4...
      const parts = signatureHeader.split(',');
      let timestamp = '';
      const signatures: string[] = [];

      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't' && value) {
          timestamp = value;
        } else if (key === 'v1' && value) {
          signatures.push(value);
        }
      }

      if (!timestamp || signatures.length === 0) {
        return false;
      }

      const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
      const payloadToSign = `${timestamp}.${bodyString}`;

      const expectedSignature = createHmac('sha256', effectiveSecret)
        .update(payloadToSign)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

      return signatures.some((sig) => {
        const sigBuffer = Buffer.from(sig, 'utf8');
        if (expectedBuffer.length !== sigBuffer.length) {
          return false;
        }
        return timingSafeEqual(expectedBuffer, sigBuffer);
      });
    } catch (err) {
      this.logger.error('Error verifying Stripe webhook signature', err);
      return false;
    }
  }

  async fetchPaymentDetails(providerPaymentId: string): Promise<PaymentDetailsResult> {
    const isLive = this.secretKey.startsWith('sk_live_');
    if (isLive) {
      const res = await fetch(`https://api.stripe.com/v1/payment_intents/${providerPaymentId}`, {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      });

      if (!res.ok) {
        throw new Error(`Stripe fetch payment failed: ${res.statusText}`);
      }

      const data = (await res.json()) as {
        id: string;
        amount: number;
        currency: string;
        status: string;
      };

      return {
        providerPaymentId: data.id,
        providerIntentId: data.id,
        amountMinor: data.amount,
        currency: data.currency.toUpperCase(),
        status: data.status === 'succeeded' ? 'captured' : 'pending',
        rawResponse: data,
      };
    }

    return {
      providerPaymentId,
      providerIntentId: providerPaymentId,
      amountMinor: 100000,
      currency: 'INR',
      status: 'captured',
    };
  }

  async createRefund(params: CreateRefundParams): Promise<RefundResult> {
    const { providerPaymentId, amountMinor, currency, reason } = params;
    const isLive = this.secretKey.startsWith('sk_live_');
    if (isLive) {
      const body = new URLSearchParams();
      body.append('payment_intent', providerPaymentId);
      body.append('amount', amountMinor.toString());
      body.append('reason', reason === 'DEFECTIVE_ITEM' ? 'fraudulent' : 'requested_by_customer');

      const res = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!res.ok) {
        throw new Error(`Stripe refund failed: ${res.statusText}`);
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
        currency: data.currency.toUpperCase(),
        status: data.status === 'succeeded' ? 'processed' : 'pending',
        rawResponse: data,
      };
    }

    const providerRefundId = `re_${randomBytes(12).toString('hex')}`;
    return {
      providerRefundId,
      amountMinor,
      currency,
      status: 'processed',
      rawResponse: { id: providerRefundId, amount: amountMinor, status: 'succeeded' },
    };
  }
}
