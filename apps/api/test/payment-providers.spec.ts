import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { RazorpayPaymentProvider } from '../src/modules/payments/providers/razorpay.provider';
import { StripePaymentProvider } from '../src/modules/payments/providers/stripe.provider';
import { MockPaymentProvider } from '../src/modules/payments/providers/mock.provider';

describe('Payment Providers - Port & Adapters', () => {
  describe('RazorpayPaymentProvider', () => {
    const provider = new RazorpayPaymentProvider();
    const webhookSecret = 'test_secret_for_razorpay_webhooks';

    it('creates sandbox order intent with correct INR amount and order prefix', async () => {
      const intent = await provider.createPaymentIntent({
        orderNumber: 'ORD-TEST-RZP-1',
        amountMinor: 250000,
        currency: 'INR',
        customer: { id: 'cust-1', email: 'c@test.com', name: 'Cust Test' },
      });

      expect(intent.providerIntentId).toMatch(/^order_/);
      expect(intent.amountMinor).toBe(250000);
      expect(intent.currency).toBe('INR');
      expect(intent.keyId).toBeDefined();
    });

    it('cryptographically verifies valid HMAC-SHA256 webhook signatures', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', entity: { id: 'pay_123' } });
      const validSignature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      expect(provider.verifyWebhookSignature(rawBody, validSignature, webhookSecret)).toBe(true);
    });

    it('strictly rejects forged or tampered webhook signatures', () => {
      const rawBody = JSON.stringify({ event: 'payment.captured', entity: { id: 'pay_123' } });
      const tamperedBody = JSON.stringify({
        event: 'payment.captured',
        entity: { id: 'pay_FORGED' },
      });
      const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      expect(provider.verifyWebhookSignature(tamperedBody, signature, webhookSecret)).toBe(false);
      expect(provider.verifyWebhookSignature(rawBody, 'invalid_signature_hex', webhookSecret)).toBe(
        false,
      );
    });

    it('verifies checkout callback signature (order_id|payment_id)', () => {
      const orderId = 'order_ABC123';
      const paymentId = 'pay_XYZ789';
      const keySecret = 'razorpay_key_secret_test';
      const validSig = createHmac('sha256', keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      expect(
        provider.verifyCheckoutSignature({
          providerOrderId: orderId,
          providerPaymentId: paymentId,
          signature: validSig,
          secret: keySecret,
        }),
      ).toBe(true);

      expect(
        provider.verifyCheckoutSignature({
          providerOrderId: orderId,
          providerPaymentId: 'pay_DIFFERENT',
          signature: validSig,
          secret: keySecret,
        }),
      ).toBe(false);
    });

    it('creates refund object in sandbox', async () => {
      const refund = await provider.createRefund({
        providerPaymentId: 'pay_test_refund_1',
        amountMinor: 50000,
        currency: 'INR',
        reason: 'CUSTOMER_CANCELLATION',
      });

      expect(refund.providerRefundId).toMatch(/^rfnd_/);
      expect(refund.amountMinor).toBe(50000);
      expect(refund.status).toBe('processed');
    });
  });

  describe('StripePaymentProvider', () => {
    const provider = new StripePaymentProvider();
    const webhookSecret = 'whsec_test_secret';

    it('creates stripe payment intent with client secret', async () => {
      const intent = await provider.createPaymentIntent({
        orderNumber: 'ORD-STRIPE-1',
        amountMinor: 100000,
        currency: 'INR',
        customer: { id: 'cust-1', email: 'cust@stripe.com', name: 'Cust Stripe' },
      });

      expect(intent.providerIntentId).toMatch(/^pi_/);
      expect(intent.clientSecret).toBeDefined();
      expect(intent.amountMinor).toBe(100000);
    });

    it('verifies valid stripe-signature header format (t=timestamp,v1=signature)', () => {
      const rawBody = JSON.stringify({ type: 'payment_intent.succeeded' });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}.${rawBody}`;
      const v1Sig = createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
      const signatureHeader = `t=${timestamp},v1=${v1Sig}`;

      expect(provider.verifyWebhookSignature(rawBody, signatureHeader, webhookSecret)).toBe(true);
    });

    it('rejects tampered stripe payload', () => {
      const rawBody = JSON.stringify({ type: 'payment_intent.succeeded' });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signedPayload = `${timestamp}.${rawBody}`;
      const v1Sig = createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
      const signatureHeader = `t=${timestamp},v1=${v1Sig}`;

      expect(
        provider.verifyWebhookSignature('{"type":"tampered"}', signatureHeader, webhookSecret),
      ).toBe(false);
    });
  });

  describe('MockPaymentProvider', () => {
    const provider = new MockPaymentProvider();

    it('creates mock intent and verifies signature with mock secret', async () => {
      const intent = await provider.createPaymentIntent({
        orderNumber: 'ORD-MOCK-1',
        amountMinor: 50000,
        currency: 'INR',
        customer: { id: 'cust-1', email: 'm@test.com', name: 'Mock' },
      });

      expect(intent.providerIntentId).toMatch(/^mock_intent_/);

      const body = 'test_body';
      const sig = createHmac('sha256', 'mock_payment_secret_for_tests').update(body).digest('hex');
      expect(provider.verifyWebhookSignature(body, sig)).toBe(true);
    });
  });
});
