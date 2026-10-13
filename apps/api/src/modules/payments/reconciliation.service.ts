import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, sql, lt } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { ReconciliationReportDto, ReconciliationDiscrepancyDto } from '@repo/api-contracts';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Performs financial ledger and payment gateway reconciliation audit.
   */
  async runReconciliationAudit(): Promise<ReconciliationReportDto> {
    const discrepancies: ReconciliationDiscrepancyDto[] = [];
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // 1. Audit: Stale Initiated Payment Attempts (> 30 mins)
    const staleAttempts = await this.databaseService.db
      .select({
        id: this.databaseService.schema.paymentAttempts.id,
        parentOrderId: this.databaseService.schema.paymentAttempts.parentOrderId,
        provider: this.databaseService.schema.paymentAttempts.provider,
        amountMinor: this.databaseService.schema.paymentAttempts.amountMinor,
        createdAt: this.databaseService.schema.paymentAttempts.createdAt,
      })
      .from(this.databaseService.schema.paymentAttempts)
      .where(
        and(
          eq(this.databaseService.schema.paymentAttempts.status, 'INITIATED'),
          lt(this.databaseService.schema.paymentAttempts.createdAt, thirtyMinutesAgo),
        ),
      );

    for (const attempt of staleAttempts) {
      discrepancies.push({
        type: 'STALE_PENDING_PAYMENT_ATTEMPT',
        entityId: attempt.id,
        description: `Payment attempt ${attempt.id} (${attempt.provider}) has remained INITIATED since ${attempt.createdAt.toISOString()} without authoritative confirmation.`,
        severity: 'MEDIUM',
        metadata: {
          parentOrderId: attempt.parentOrderId,
          amountMinor: attempt.amountMinor,
          provider: attempt.provider,
        },
      });
    }

    // 2. Audit: Amount mismatches between order and payment attempt
    const amountMismatches = await this.databaseService.db
      .select({
        attemptId: this.databaseService.schema.paymentAttempts.id,
        orderId: this.databaseService.schema.customerOrders.id,
        orderNumber: this.databaseService.schema.customerOrders.orderNumber,
        attemptAmount: this.databaseService.schema.paymentAttempts.amountMinor,
        orderAmount: this.databaseService.schema.customerOrders.totalAmountMinor,
      })
      .from(this.databaseService.schema.paymentAttempts)
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.paymentAttempts.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(
        sql`${this.databaseService.schema.paymentAttempts.amountMinor} != ${this.databaseService.schema.customerOrders.totalAmountMinor}`,
      );

    for (const mismatch of amountMismatches) {
      discrepancies.push({
        type: 'AMOUNT_MISMATCH',
        entityId: mismatch.attemptId,
        description: `Payment attempt ${mismatch.attemptId} amount (${mismatch.attemptAmount}) does not match parent order ${mismatch.orderNumber} total (${mismatch.orderAmount})`,
        severity: 'CRITICAL',
        metadata: mismatch,
      });
    }

    // 3. Audit: Unprocessed Webhook Events (> 15 mins)
    const unprocessedWebhooks = await this.databaseService.db
      .select({
        id: this.databaseService.schema.paymentWebhookEvents.id,
        provider: this.databaseService.schema.paymentWebhookEvents.provider,
        eventId: this.databaseService.schema.paymentWebhookEvents.eventId,
        eventType: this.databaseService.schema.paymentWebhookEvents.eventType,
        createdAt: this.databaseService.schema.paymentWebhookEvents.createdAt,
      })
      .from(this.databaseService.schema.paymentWebhookEvents)
      .where(
        and(
          eq(this.databaseService.schema.paymentWebhookEvents.processed, false),
          lt(this.databaseService.schema.paymentWebhookEvents.createdAt, fifteenMinutesAgo),
        ),
      );

    for (const webhook of unprocessedWebhooks) {
      discrepancies.push({
        type: 'UNPROCESSED_WEBHOOK_EVENT',
        entityId: webhook.id,
        description: `Webhook event ${webhook.eventId} (${webhook.provider} / ${webhook.eventType}) received at ${webhook.createdAt.toISOString()} has not been processed`,
        severity: 'HIGH',
        metadata: webhook,
      });
    }

    // 4. Audit: Double-entry ledger balance audit (sum(Debits) === sum(Credits))
    const unbalancedBatches = await this.databaseService.db.execute<{
      journal_batch_id: string;
      debit_sum: string;
      credit_sum: string;
      diff: string;
    }>(sql`
      SELECT
        journal_batch_id,
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) as debit_sum,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END), 0) as credit_sum,
        (COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END), 0)) as diff
      FROM ledger_entries
      GROUP BY journal_batch_id
      HAVING (COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_minor ELSE 0 END), 0)) != 0;
    `);

    const unbalancedRows = Array.isArray(unbalancedBatches) ? unbalancedBatches : [];
    for (const batch of unbalancedRows) {
      discrepancies.push({
        type: 'UNBALANCED_LEDGER_BATCH',
        entityId: batch.journal_batch_id,
        description: `Ledger journal batch ${batch.journal_batch_id} violates double-entry invariant! Debits: ${batch.debit_sum}, Credits: ${batch.credit_sum}, Imbalance: ${batch.diff}`,
        severity: 'CRITICAL',
        metadata: batch,
      });
    }

    const totalAttemptsCount = await this.databaseService.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.databaseService.schema.paymentAttempts);

    const isHealthy = discrepancies.length === 0;

    return {
      generatedAt: new Date().toISOString(),
      totalAttemptsChecked: totalAttemptsCount[0]?.count ?? 0,
      stalePendingCount: staleAttempts.length,
      amountMismatchCount: amountMismatches.length,
      unprocessedWebhooksCount: unprocessedWebhooks.length,
      unbalancedBatchesCount: unbalancedRows.length,
      discrepancies,
      isHealthy,
    };
  }
}
