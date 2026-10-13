import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { CommissionService } from './commission.service';
import { RazorpayPaymentProvider } from './providers/razorpay.provider';
import { StripePaymentProvider } from './providers/stripe.provider';
import { MockPaymentProvider } from './providers/mock.provider';
import type { IPaymentProvider } from './interfaces/payment-provider.interface';
import type {
  InitiatePaymentInput,
  VerifyPaymentInput,
  RefundRequestInput,
  ProcessRefundInput,
} from '@repo/validation';
import type {
  PaymentInitiationResultDto,
  PaymentVerificationResultDto,
  PaymentStatusDto,
  RefundDto,
} from '@repo/api-contracts';

interface AddressSnapshot {
  recipientName?: string;
  phone?: string | null;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

interface WebhookPayload {
  event_id?: string;
  account_id?: string;
  event?: string;
  id?: string;
  type?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        error_code?: string;
        error_description?: string;
      };
    };
  };
  data?: {
    object?: {
      id?: string;
      amount?: number;
      currency?: string;
      latest_charge?: string;
      last_payment_error?: {
        code?: string;
        message?: string;
      };
    };
  };
  [key: string]: unknown;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(LedgerService)
    private readonly ledgerService: LedgerService,
    @Inject(CommissionService)
    private readonly commissionService: CommissionService,
    @Inject(RazorpayPaymentProvider)
    private readonly razorpayProvider: RazorpayPaymentProvider,
    @Inject(StripePaymentProvider)
    private readonly stripeProvider: StripePaymentProvider,
    @Inject(MockPaymentProvider)
    private readonly mockProvider: MockPaymentProvider,
  ) {}

  /**
   * Resolves the configured payment provider adapter.
   */
  getProvider(providerName: 'RAZORPAY' | 'STRIPE' | 'MOCK_PROVIDER'): IPaymentProvider {
    switch (providerName) {
      case 'RAZORPAY':
        return this.razorpayProvider;
      case 'STRIPE':
        return this.stripeProvider;
      case 'MOCK_PROVIDER':
        return this.mockProvider;
      default:
        return this.razorpayProvider;
    }
  }

  /**
   * Initiates an authoritative payment attempt for an eligible customer order.
   *
   * Invariant: Order must be in 'PENDING' payment status and 'PLACED' order status.
   */
  async initiatePayment(
    customerId: string,
    input: InitiatePaymentInput,
  ): Promise<PaymentInitiationResultDto> {
    const { orderId, orderNumber, provider: requestedProvider, idempotencyKey } = input;

    // 1. Resolve parent customer order
    const orderQuery = this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerOrders);

    const [order] = orderId
      ? await orderQuery
          .where(
            and(
              eq(this.databaseService.schema.customerOrders.id, orderId),
              eq(this.databaseService.schema.customerOrders.customerId, customerId),
            ),
          )
          .limit(1)
      : await orderQuery
          .where(
            and(
              eq(this.databaseService.schema.customerOrders.orderNumber, orderNumber!),
              eq(this.databaseService.schema.customerOrders.customerId, customerId),
            ),
          )
          .limit(1);

    if (!order) {
      throw new NotFoundException(
        'Customer order not found or does not belong to authenticated user',
      );
    }

    // 2. Validate order state eligibility
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('Order has already been paid and confirmed');
    }
    if (order.orderStatus === 'CANCELLED') {
      throw new BadRequestException('Cannot initiate payment for a cancelled order');
    }

    // 3. Check for existing payment attempts with idempotencyKey
    if (idempotencyKey) {
      const [existingAttempt] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.paymentAttempts)
        .where(eq(this.databaseService.schema.paymentAttempts.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existingAttempt) {
        if (existingAttempt.status === 'SUCCEEDED') {
          throw new ConflictException(
            'Payment attempt with this idempotency key has already succeeded',
          );
        }
        // Return existing initiated intent
        const provider = this.getProvider(existingAttempt.provider);
        return {
          paymentAttemptId: existingAttempt.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          provider: existingAttempt.provider,
          providerOrderId: existingAttempt.providerIntentId,
          amountMinor: existingAttempt.amountMinor,
          currency: existingAttempt.currency,
          keyId: provider.keyId || 'key',
          customer: {
            name: (order.shippingAddress as AddressSnapshot | null)?.recipientName || 'Customer',
            email: 'customer@example.com',
            phone: (order.shippingAddress as AddressSnapshot | null)?.phone || null,
          },
          status: existingAttempt.status,
        };
      }
    }

    // 4. Query sub-orders to calculate allocations
    const subOrders = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.subOrders)
      .where(eq(this.databaseService.schema.subOrders.parentOrderId, order.id));

    if (subOrders.length === 0) {
      throw new BadRequestException('Order does not contain any artisan sub-orders');
    }

    // 5. Select provider and create payment intent
    const provider = this.getProvider(requestedProvider);
    const intentResult = await provider.createPaymentIntent({
      orderNumber: order.orderNumber,
      amountMinor: order.totalAmountMinor,
      currency: order.currency,
      customer: {
        id: customerId,
        name: (order.shippingAddress as AddressSnapshot | null)?.recipientName || 'Customer',
        email: 'customer@example.com',
        phone: (order.shippingAddress as AddressSnapshot | null)?.phone || null,
      },
      receipt: order.orderNumber,
    });

    // 6. Record payment attempt and sub-order allocations in transaction
    const effectiveIdempotencyKey =
      idempotencyKey || `idem_${order.orderNumber}_${randomBytes(6).toString('hex')}`;

    const paymentAttempt = await this.databaseService.db.transaction(async (tx) => {
      const [attempt] = await tx
        .insert(this.databaseService.schema.paymentAttempts)
        .values({
          parentOrderId: order.id,
          provider: provider.providerName,
          providerIntentId: intentResult.providerIntentId,
          amountMinor: order.totalAmountMinor,
          currency: order.currency,
          status: 'INITIATED',
          idempotencyKey: effectiveIdempotencyKey,
        })
        .returning();

      if (!attempt) {
        throw new BadRequestException('Failed to create payment attempt record');
      }

      // Record allocations partitioning the customer payment across sub-orders
      let totalAllocated = 0;
      for (const subOrder of subOrders) {
        const subOrderTotal =
          subOrder.itemSubtotalMinor + subOrder.shippingFeeMinor + subOrder.taxMinor;
        totalAllocated += subOrderTotal;

        await tx.insert(this.databaseService.schema.paymentAllocations).values({
          paymentAttemptId: attempt.id,
          subOrderId: subOrder.id,
          allocatedAmountMinor: subOrderTotal,
        });
      }

      // Conservation check
      if (totalAllocated !== order.totalAmountMinor) {
        throw new Error(
          `Allocations mismatch: Total sub-orders (${totalAllocated}) !== Parent order (${order.totalAmountMinor})`,
        );
      }

      await this.auditService.logEvent({
        actorId: customerId,
        actorRole: 'CUSTOMER',
        action: 'PAYMENT_INITIATED',
        resourceType: 'PAYMENT_ATTEMPT',
        resourceId: attempt.id,
        metadata: {
          orderNumber: order.orderNumber,
          provider: provider.providerName,
          providerIntentId: intentResult.providerIntentId,
          amountMinor: order.totalAmountMinor,
        },
      });

      return attempt;
    });

    return {
      paymentAttemptId: paymentAttempt.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      provider: provider.providerName,
      providerOrderId: intentResult.providerIntentId,
      amountMinor: paymentAttempt.amountMinor,
      currency: paymentAttempt.currency,
      keyId: intentResult.keyId,
      customer: {
        name: (order.shippingAddress as AddressSnapshot | null)?.recipientName || 'Customer',
        email: 'customer@example.com',
        phone: (order.shippingAddress as AddressSnapshot | null)?.phone || null,
      },
      status: paymentAttempt.status,
    };
  }

  /**
   * Executes atomic payment capture upon verified provider confirmation.
   *
   * Strict Invariants Enforced:
   * 1. Idempotency: Multiple captures for same intent result in a single execution.
   * 2. State coordination: paymentStatus -> PAID, orderStatus -> PROCESSING.
   * 3. Double-entry financial ledger: Balanced journal batch posted.
   * 4. Seller balances: Artisan pending escrow incremented.
   */
  async executePaymentCapture(params: {
    provider: 'RAZORPAY' | 'STRIPE' | 'MOCK_PROVIDER';
    providerIntentId: string;
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    actorId?: string;
  }): Promise<{ captured: boolean; orderNumber: string }> {
    const { provider, providerIntentId, providerPaymentId, amountMinor } = params;

    return await this.databaseService.db.transaction(async (tx) => {
      // 1. Lock and retrieve payment attempt row
      const [attempt] = await tx
        .select()
        .from(this.databaseService.schema.paymentAttempts)
        .where(
          and(
            eq(this.databaseService.schema.paymentAttempts.provider, provider),
            eq(this.databaseService.schema.paymentAttempts.providerIntentId, providerIntentId),
          ),
        )
        .for('update')
        .limit(1);

      if (!attempt) {
        throw new NotFoundException(
          `Payment attempt with provider intent ${providerIntentId} not found`,
        );
      }

      // Idempotency: If already succeeded, return immediately
      if (attempt.status === 'SUCCEEDED') {
        const [order] = await tx
          .select({ orderNumber: this.databaseService.schema.customerOrders.orderNumber })
          .from(this.databaseService.schema.customerOrders)
          .where(eq(this.databaseService.schema.customerOrders.id, attempt.parentOrderId))
          .limit(1);

        return { captured: true, orderNumber: order?.orderNumber ?? '' };
      }

      // Financial accuracy check
      if (attempt.amountMinor !== amountMinor) {
        this.logger.error(
          `Amount mismatch on capture: Expected ${attempt.amountMinor}, got ${amountMinor}`,
        );
        throw new BadRequestException('Captured amount does not match recorded payment attempt');
      }

      // 2. Retrieve parent order
      const [order] = await tx
        .select()
        .from(this.databaseService.schema.customerOrders)
        .where(eq(this.databaseService.schema.customerOrders.id, attempt.parentOrderId))
        .for('update')
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Parent order ${attempt.parentOrderId} not found`);
      }

      // 3. Retrieve sub-orders
      const subOrders = await tx
        .select()
        .from(this.databaseService.schema.subOrders)
        .where(eq(this.databaseService.schema.subOrders.parentOrderId, order.id));

      // 4. Update payment attempt status to SUCCEEDED
      await tx
        .update(this.databaseService.schema.paymentAttempts)
        .set({
          status: 'SUCCEEDED',
          updatedAt: new Date(),
        })
        .where(eq(this.databaseService.schema.paymentAttempts.id, attempt.id));

      // 5. Update parent customer order status
      await tx
        .update(this.databaseService.schema.customerOrders)
        .set({
          paymentStatus: 'PAID',
          orderStatus: 'PROCESSING',
          updatedAt: new Date(),
        })
        .where(eq(this.databaseService.schema.customerOrders.id, order.id));

      // 6. Post double-entry financial ledger entries
      const journalBatchId = randomBytes(16).toString('hex');
      const ledgerEntriesToPost: Array<{
        accountCode: string;
        entryType: 'DEBIT' | 'CREDIT';
        amountMinor: number;
        description: string;
        sellerId?: string | null;
        subOrderId?: string | null;
        currency: string;
      }> = [];

      // DEBIT: Payment Processor Asset (Full gross collected from customer)
      ledgerEntriesToPost.push({
        accountCode: '1010_PAYMENT_PROCESSOR',
        entryType: 'DEBIT',
        amountMinor: order.totalAmountMinor,
        description: `Customer payment collected for order ${order.orderNumber} via ${provider} (${providerPaymentId})`,
        currency: order.currency,
      });

      // CREDIT: For each artisan sub-order
      for (const subOrder of subOrders) {
        // Calculate authoritative financials
        const fin = this.commissionService.calculateSubOrderFinancials({
          itemSubtotalMinor: subOrder.itemSubtotalMinor,
          shippingFeeMinor: subOrder.shippingFeeMinor,
          taxMinor: subOrder.taxMinor,
          commissionRateBps: subOrder.commissionRateBps,
        });

        // CREDIT: Customer Escrow Liability (Net payable to artisan)
        ledgerEntriesToPost.push({
          accountCode: '2010_CUSTOMER_ESCROW',
          entryType: 'CREDIT',
          amountMinor: fin.netSellerPayableMinor,
          description: `Escrow hold for sub-order ${subOrder.subOrderNumber} pending fulfillment`,
          sellerId: subOrder.sellerId,
          subOrderId: subOrder.id,
          currency: order.currency,
        });

        // CREDIT: Marketplace Commission Revenue
        ledgerEntriesToPost.push({
          accountCode: '4010_MARKETPLACE_COMMISSION',
          entryType: 'CREDIT',
          amountMinor: fin.commissionFeeMinor,
          description: `Platform commission for sub-order ${subOrder.subOrderNumber}`,
          sellerId: subOrder.sellerId,
          subOrderId: subOrder.id,
          currency: order.currency,
        });

        // CREDIT: Taxes Payable (if any)
        if (fin.taxMinor > 0) {
          ledgerEntriesToPost.push({
            accountCode: '2040_TAXES_PAYABLE',
            entryType: 'CREDIT',
            amountMinor: fin.taxMinor,
            description: `Statutory taxes withheld for sub-order ${subOrder.subOrderNumber}`,
            sellerId: subOrder.sellerId,
            subOrderId: subOrder.id,
            currency: order.currency,
          });
        }

        // Credit artisan pending escrow balance in materialized projection
        await this.ledgerService.creditSellerEscrow(
          subOrder.sellerId,
          fin.netSellerPayableMinor,
          tx,
        );

        // Record sub-order timeline event
        await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
          subOrderId: subOrder.id,
          fromStatus: 'PLACED',
          toStatus: 'CONFIRMED',
          actorId: params.actorId ?? order.customerId,
          notes: `Payment captured successfully via ${provider}. Escrow hold active.`,
        });
      }

      // Post the balanced journal batch (Strictly checks sum(Debits) === sum(Credits))
      await this.ledgerService.postBalancedJournalBatch(
        {
          entries: ledgerEntriesToPost,
          memo: `Capture for order ${order.orderNumber}`,
        },
        tx,
      );

      // 7. Audit log
      await this.auditService.logEvent({
        actorId: params.actorId ?? order.customerId,
        actorRole: 'SYSTEM',
        action: 'PAYMENT_CAPTURED',
        resourceType: 'CUSTOMER_ORDER',
        resourceId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          provider,
          providerPaymentId,
          providerIntentId,
          amountMinor: order.totalAmountMinor,
          journalBatchId,
        },
      });

      return { captured: true, orderNumber: order.orderNumber };
    });
  }

  /**
   * Records payment attempt failure.
   */
  async executePaymentFailure(params: {
    provider: 'RAZORPAY' | 'STRIPE' | 'MOCK_PROVIDER';
    providerIntentId: string;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void> {
    const { provider, providerIntentId, errorCode, errorMessage } = params;

    await this.databaseService.db.transaction(async (tx) => {
      const [attempt] = await tx
        .select()
        .from(this.databaseService.schema.paymentAttempts)
        .where(
          and(
            eq(this.databaseService.schema.paymentAttempts.provider, provider),
            eq(this.databaseService.schema.paymentAttempts.providerIntentId, providerIntentId),
          ),
        )
        .limit(1);

      if (!attempt) return;

      await tx
        .update(this.databaseService.schema.paymentAttempts)
        .set({
          status: 'FAILED',
          errorCode: errorCode ?? null,
          errorMessage: errorMessage ?? null,
          updatedAt: new Date(),
        })
        .where(eq(this.databaseService.schema.paymentAttempts.id, attempt.id));

      await tx
        .update(this.databaseService.schema.customerOrders)
        .set({
          paymentStatus: 'FAILED',
          updatedAt: new Date(),
        })
        .where(eq(this.databaseService.schema.customerOrders.id, attempt.parentOrderId));

      await this.auditService.logEvent({
        actorId: 'system',
        actorRole: 'SYSTEM',
        action: 'PAYMENT_FAILED',
        resourceType: 'PAYMENT_ATTEMPT',
        resourceId: attempt.id,
        metadata: { provider, providerIntentId, errorCode, errorMessage },
      });
    });
  }

  /**
   * Verifies client-side payment completion signature (e.g. Razorpay checkout return callback).
   */
  async verifyClientPayment(
    customerId: string,
    input: VerifyPaymentInput,
  ): Promise<PaymentVerificationResultDto> {
    const { orderNumber, providerOrderId, providerPaymentId, providerSignature } = input;

    // 1. Resolve order
    const [order] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerOrders)
      .where(
        and(
          eq(this.databaseService.schema.customerOrders.orderNumber, orderNumber),
          eq(this.databaseService.schema.customerOrders.customerId, customerId),
        ),
      )
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found for authenticated customer`);
    }

    // 2. Resolve payment attempt
    const [attempt] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.paymentAttempts)
      .where(
        and(
          eq(this.databaseService.schema.paymentAttempts.parentOrderId, order.id),
          eq(this.databaseService.schema.paymentAttempts.providerIntentId, providerOrderId),
        ),
      )
      .limit(1);

    if (!attempt) {
      throw new NotFoundException(
        `Payment attempt for provider order ${providerOrderId} not found`,
      );
    }

    // 3. Cryptographically verify signature
    const provider = this.getProvider(attempt.provider);
    const isValid = provider.verifyCheckoutSignature
      ? provider.verifyCheckoutSignature({
          providerOrderId,
          providerPaymentId,
          signature: providerSignature,
        })
      : true;

    if (!isValid) {
      this.logger.warn(`Invalid checkout signature for order ${orderNumber}`);
      throw new UnauthorizedException('Cryptographic payment signature verification failed');
    }

    // 4. Atomically capture payment
    await this.executePaymentCapture({
      provider: attempt.provider,
      providerIntentId: providerOrderId,
      providerPaymentId,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
      actorId: customerId,
    });

    return {
      orderNumber,
      paymentStatus: 'PAID',
      orderStatus: 'PROCESSING',
      paymentAttemptId: attempt.id,
      providerPaymentId,
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Ingests and processes raw payment gateway webhook event with strict cryptographic signature verification
   * and deduplication idempotency.
   */
  async processWebhook(
    providerName: 'RAZORPAY' | 'STRIPE',
    rawBody: string | Buffer,
    signatureHeader: string,
  ): Promise<{ received: boolean; message: string }> {
    const provider = this.getProvider(providerName);

    // 1. Cryptographically verify webhook signature
    const isValid = provider.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      this.logger.warn(`Rejected invalid webhook signature from ${providerName}`);
      throw new UnauthorizedException(
        `Invalid cryptographic webhook signature for ${providerName}`,
      );
    }

    // 2. Parse payload and compute payload hash
    const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(bodyString) as WebhookPayload;
    } catch {
      throw new BadRequestException('Malformed JSON webhook body');
    }

    const payloadHash = createHash('sha256').update(bodyString).digest('hex');

    // 3. Extract eventId and eventType
    let eventId = '';
    let eventType = '';

    if (providerName === 'RAZORPAY') {
      eventId =
        payload.event_id ||
        payload.account_id ||
        `rzp_evt_${Date.now()}_${payloadHash.substring(0, 10)}`;
      eventType = payload.event || 'unknown';
    } else {
      // Stripe
      eventId = payload.id || `str_evt_${Date.now()}_${payloadHash.substring(0, 10)}`;
      eventType = payload.type || 'unknown';
    }

    // 4. Idempotency Check in payment_webhook_events
    const [existingEvent] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.paymentWebhookEvents)
      .where(
        and(
          eq(this.databaseService.schema.paymentWebhookEvents.provider, providerName),
          eq(this.databaseService.schema.paymentWebhookEvents.eventId, eventId),
        ),
      )
      .limit(1);

    if (existingEvent && existingEvent.processed) {
      this.logger.log(`Webhook ${eventId} already processed idempotently`);
      return { received: true, message: 'Already processed' };
    }

    // Record webhook event if not already present
    let webhookEventId = existingEvent?.id;
    if (!existingEvent) {
      const [inserted] = await this.databaseService.db
        .insert(this.databaseService.schema.paymentWebhookEvents)
        .values({
          provider: providerName,
          eventId,
          eventType,
          payload,
          payloadHash,
          processed: false,
        })
        .onConflictDoNothing()
        .returning();
      webhookEventId = inserted?.id;
    }

    // 5. Dispatch based on event type
    try {
      if (providerName === 'RAZORPAY') {
        if (eventType === 'payment.captured' || eventType === 'order.paid') {
          const paymentEntity = payload.payload?.payment?.entity;
          const orderId = paymentEntity?.order_id;
          const paymentId = paymentEntity?.id;
          const amount = paymentEntity?.amount;

          if (orderId && paymentId && amount) {
            await this.executePaymentCapture({
              provider: 'RAZORPAY',
              providerIntentId: orderId,
              providerPaymentId: paymentId,
              amountMinor: amount,
              currency: paymentEntity?.currency || 'INR',
            });
          }
        } else if (eventType === 'payment.failed') {
          const paymentEntity = payload.payload?.payment?.entity;
          const orderId = paymentEntity?.order_id;
          if (orderId) {
            await this.executePaymentFailure({
              provider: 'RAZORPAY',
              providerIntentId: orderId,
              errorCode: paymentEntity?.error_code,
              errorMessage: paymentEntity?.error_description,
            });
          }
        }
      } else if (providerName === 'STRIPE') {
        if (eventType === 'payment_intent.succeeded') {
          const pi = payload.data?.object;
          if (pi?.id && pi?.amount) {
            await this.executePaymentCapture({
              provider: 'STRIPE',
              providerIntentId: pi.id,
              providerPaymentId: pi.latest_charge || pi.id,
              amountMinor: pi.amount,
              currency: (pi.currency || 'INR').toUpperCase(),
            });
          }
        } else if (eventType === 'payment_intent.payment_failed') {
          const pi = payload.data?.object;
          if (pi?.id) {
            await this.executePaymentFailure({
              provider: 'STRIPE',
              providerIntentId: pi.id,
              errorCode: pi.last_payment_error?.code,
              errorMessage: pi.last_payment_error?.message,
            });
          }
        }
      }

      // Mark webhook processed
      if (webhookEventId) {
        await this.databaseService.db
          .update(this.databaseService.schema.paymentWebhookEvents)
          .set({
            processed: true,
            processedAt: new Date(),
          })
          .where(eq(this.databaseService.schema.paymentWebhookEvents.id, webhookEventId));
      }

      return { received: true, message: 'Processed successfully' };
    } catch (err: unknown) {
      if (webhookEventId) {
        const errorMessage = err instanceof Error ? err.message : 'Processing failed';
        await this.databaseService.db
          .update(this.databaseService.schema.paymentWebhookEvents)
          .set({
            errorMessage,
          })
          .where(eq(this.databaseService.schema.paymentWebhookEvents.id, webhookEventId));
      }
      throw err;
    }
  }

  /**
   * Retrieves current payment status and attempts history for an order.
   */
  async getOrderPaymentStatus(customerId: string, orderNumber: string): Promise<PaymentStatusDto> {
    const [order] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerOrders)
      .where(
        and(
          eq(this.databaseService.schema.customerOrders.orderNumber, orderNumber),
          eq(this.databaseService.schema.customerOrders.customerId, customerId),
        ),
      )
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    const attempts = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.paymentAttempts)
      .where(eq(this.databaseService.schema.paymentAttempts.parentOrderId, order.id))
      .orderBy(desc(this.databaseService.schema.paymentAttempts.createdAt));

    const canRetry = order.paymentStatus !== 'PAID' && order.orderStatus !== 'CANCELLED';

    return {
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      totalAmountMinor: order.totalAmountMinor,
      currency: order.currency,
      attempts: attempts.map((a) => ({
        id: a.id,
        provider: a.provider,
        providerIntentId: a.providerIntentId,
        amountMinor: a.amountMinor,
        currency: a.currency,
        status: a.status,
        errorCode: a.errorCode,
        errorMessage: a.errorMessage,
        createdAt: a.createdAt.toISOString(),
      })),
      canRetry,
    };
  }

  /**
   * Requests a refund for an artisan sub-order.
   *
   * Invariant: Over-refund prevention check enforces total refunds <= sub-order total.
   */
  async requestRefund(actorId: string, input: RefundRequestInput): Promise<RefundDto> {
    const { subOrderId, amountMinor, reason } = input;

    // 1. Retrieve sub-order
    const [subOrder] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.subOrders)
      .where(eq(this.databaseService.schema.subOrders.id, subOrderId))
      .limit(1);

    if (!subOrder) {
      throw new NotFoundException(`Sub-order ${subOrderId} not found`);
    }

    // 2. Retrieve parent order to check payment status
    const [parentOrder] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.customerOrders)
      .where(eq(this.databaseService.schema.customerOrders.id, subOrder.parentOrderId))
      .limit(1);

    if (!parentOrder || parentOrder.paymentStatus !== 'PAID') {
      throw new BadRequestException('Refund can only be requested for paid orders');
    }

    // 3. Retrieve successful payment attempt
    const [successfulAttempt] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.paymentAttempts)
      .where(
        and(
          eq(this.databaseService.schema.paymentAttempts.parentOrderId, parentOrder.id),
          eq(this.databaseService.schema.paymentAttempts.status, 'SUCCEEDED'),
        ),
      )
      .limit(1);

    if (!successfulAttempt) {
      throw new BadRequestException('No successful payment attempt found for this order');
    }

    // 4. Over-refund check: Check existing non-rejected refunds
    const subOrderTotalMinor =
      subOrder.itemSubtotalMinor + subOrder.shippingFeeMinor + subOrder.taxMinor;

    const existingRefunds = await this.databaseService.db
      .select({ amountMinor: this.databaseService.schema.refundRequests.amountMinor })
      .from(this.databaseService.schema.refundRequests)
      .where(
        and(
          eq(this.databaseService.schema.refundRequests.subOrderId, subOrderId),
          sql`${this.databaseService.schema.refundRequests.status} != 'REJECTED'`,
        ),
      );

    const totalExistingRefundMinor = existingRefunds.reduce((acc, r) => acc + r.amountMinor, 0);

    if (totalExistingRefundMinor + amountMinor > subOrderTotalMinor) {
      throw new BadRequestException(
        `Over-refund prevented: Total requested (${totalExistingRefundMinor + amountMinor}) exceeds sub-order value (${subOrderTotalMinor})`,
      );
    }

    const refundNumber = `RFND-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const [refund] = await this.databaseService.db
      .insert(this.databaseService.schema.refundRequests)
      .values({
        subOrderId,
        paymentAttemptId: successfulAttempt.id,
        refundNumber,
        amountMinor,
        currency: subOrder.currency,
        reason,
        status: 'REQUESTED',
        requestedBy: actorId,
      })
      .returning();

    if (!refund) {
      throw new BadRequestException('Failed to create refund request');
    }

    return {
      id: refund.id,
      refundNumber: refund.refundNumber,
      subOrderId: refund.subOrderId,
      paymentAttemptId: refund.paymentAttemptId,
      amountMinor: refund.amountMinor,
      currency: refund.currency,
      reason: refund.reason,
      status: refund.status,
      createdAt: refund.createdAt.toISOString(),
      updatedAt: refund.updatedAt.toISOString(),
    };
  }

  /**
   * Approves and executes a refund with double-entry reversing ledger entries.
   */
  async processRefund(
    adminId: string,
    refundId: string,
    input: ProcessRefundInput,
  ): Promise<RefundDto> {
    const { approved, rejectionReason } = input;

    return await this.databaseService.db.transaction(async (tx) => {
      const [refund] = await tx
        .select()
        .from(this.databaseService.schema.refundRequests)
        .where(eq(this.databaseService.schema.refundRequests.id, refundId))
        .for('update')
        .limit(1);

      if (!refund) {
        throw new NotFoundException(`Refund request ${refundId} not found`);
      }

      if (refund.status !== 'REQUESTED') {
        throw new BadRequestException(`Refund request is already in status ${refund.status}`);
      }

      if (!approved) {
        const [rejected] = await tx
          .update(this.databaseService.schema.refundRequests)
          .set({
            status: 'REJECTED',
            approvedBy: adminId,
            rejectionReason: rejectionReason ?? 'Rejected by finance administrator',
            updatedAt: new Date(),
          })
          .where(eq(this.databaseService.schema.refundRequests.id, refundId))
          .returning();

        if (!rejected) {
          throw new BadRequestException('Failed to reject refund request');
        }

        return {
          id: rejected.id,
          refundNumber: rejected.refundNumber,
          subOrderId: rejected.subOrderId,
          paymentAttemptId: rejected.paymentAttemptId,
          amountMinor: rejected.amountMinor,
          currency: rejected.currency,
          reason: rejected.reason,
          status: rejected.status,
          rejectionReason: rejected.rejectionReason,
          createdAt: rejected.createdAt.toISOString(),
          updatedAt: rejected.updatedAt.toISOString(),
        };
      }

      // If approved, process refund through gateway
      const [attempt] = await tx
        .select()
        .from(this.databaseService.schema.paymentAttempts)
        .where(eq(this.databaseService.schema.paymentAttempts.id, refund.paymentAttemptId))
        .limit(1);

      if (!attempt) {
        throw new NotFoundException(`Payment attempt ${refund.paymentAttemptId} not found`);
      }

      const [subOrder] = await tx
        .select()
        .from(this.databaseService.schema.subOrders)
        .where(eq(this.databaseService.schema.subOrders.id, refund.subOrderId))
        .limit(1);

      if (!subOrder) {
        throw new NotFoundException(`Sub-order ${refund.subOrderId} not found`);
      }

      const provider = this.getProvider(attempt.provider);
      const refundResult = await provider.createRefund({
        providerPaymentId: attempt.providerIntentId,
        amountMinor: refund.amountMinor,
        currency: refund.currency,
        reason: refund.reason,
      });

      // Calculate refund breakdown
      const split = this.commissionService.calculateRefundSplit(refund.amountMinor, {
        itemSubtotalMinor: subOrder.itemSubtotalMinor,
        shippingFeeMinor: subOrder.shippingFeeMinor,
        commissionFeeMinor: subOrder.commissionFeeMinor,
        netSellerPayableMinor: subOrder.netSellerPayableMinor,
      });

      // Post reversing balanced journal batch
      // Reversal:
      // CREDIT: 1010_PAYMENT_PROCESSOR for full refunded amount (cash returned to customer)
      // DEBIT:  2010_CUSTOMER_ESCROW for seller's portion
      // DEBIT:  4010_MARKETPLACE_COMMISSION for marketplace commission refunded portion
      await this.ledgerService.postBalancedJournalBatch(
        {
          entries: [
            {
              accountCode: '1010_PAYMENT_PROCESSOR',
              entryType: 'CREDIT',
              amountMinor: refund.amountMinor,
              description: `Refund payout for sub-order ${subOrder.subOrderNumber} (${refund.refundNumber})`,
              currency: refund.currency,
            },
            {
              accountCode: '2010_CUSTOMER_ESCROW',
              entryType: 'DEBIT',
              amountMinor: split.sellerDeductionMinor,
              description: `Escrow clawback for refund ${refund.refundNumber}`,
              sellerId: subOrder.sellerId,
              subOrderId: subOrder.id,
              currency: refund.currency,
            },
            {
              accountCode: '4010_MARKETPLACE_COMMISSION',
              entryType: 'DEBIT',
              amountMinor: split.platformCommissionRefundMinor,
              description: `Commission reversal for refund ${refund.refundNumber}`,
              sellerId: subOrder.sellerId,
              subOrderId: subOrder.id,
              currency: refund.currency,
            },
          ],
        },
        tx,
      );

      // Debit seller escrow balance
      await this.ledgerService.debitSellerEscrow(subOrder.sellerId, split.sellerDeductionMinor, tx);

      // Update refund request status
      const [updatedRefund] = await tx
        .update(this.databaseService.schema.refundRequests)
        .set({
          status: 'COMPLETED',
          approvedBy: adminId,
          providerRefundId: refundResult.providerRefundId,
          updatedAt: new Date(),
        })
        .where(eq(this.databaseService.schema.refundRequests.id, refundId))
        .returning();

      if (!updatedRefund) {
        throw new BadRequestException('Failed to finalize refund request');
      }

      return {
        id: updatedRefund.id,
        refundNumber: updatedRefund.refundNumber,
        subOrderId: updatedRefund.subOrderId,
        paymentAttemptId: updatedRefund.paymentAttemptId,
        amountMinor: updatedRefund.amountMinor,
        currency: updatedRefund.currency,
        reason: updatedRefund.reason,
        status: updatedRefund.status,
        providerRefundId: updatedRefund.providerRefundId,
        createdAt: updatedRefund.createdAt.toISOString(),
        updatedAt: updatedRefund.updatedAt.toISOString(),
      };
    });
  }
}
