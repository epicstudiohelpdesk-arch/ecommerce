import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { PaymentsService } from '../payments/payments.service';
import type {
  CreateDisputeInput,
  SellerDisputeResponseInput,
  ResolveDisputeInput,
  DisputeQuery,
} from '@repo/validation';
import type {
  DisputeListItemDto,
  DisputeDetailDto,
  PaginatedDisputesDto,
} from '@repo/api-contracts';

const INTERNAL_ROLES = [
  'SUPER_ADMIN',
  'MARKETPLACE_MANAGER',
  'CUSTOMER_SUPPORT',
  'TRUST_SAFETY',
  'FINANCE_CONTROLLER',
  'READ_ONLY_ANALYST',
];

@Injectable()
export class DisputesService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(PaymentsService)
    private readonly paymentsService: PaymentsService,
  ) {}

  private isInternalStaff(role: string): boolean {
    return INTERNAL_ROLES.includes(role);
  }

  /**
   * Opens an official dispute for a specific artisan sub-order.
   */
  async createDispute(customerId: string, input: CreateDisputeInput): Promise<DisputeDetailDto> {
    // 1. Verify sub-order and ensure it belongs to this customer
    const [subOrder] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.subOrders.id,
        subOrderNumber: this.databaseService.schema.subOrders.subOrderNumber,
        sellerId: this.databaseService.schema.subOrders.sellerId,
        status: this.databaseService.schema.subOrders.status,
        itemSubtotalMinor: this.databaseService.schema.subOrders.itemSubtotalMinor,
        shippingFeeMinor: this.databaseService.schema.subOrders.shippingFeeMinor,
        taxMinor: this.databaseService.schema.subOrders.taxMinor,
        currency: this.databaseService.schema.subOrders.currency,
        parentCustomerId: this.databaseService.schema.customerOrders.customerId,
      })
      .from(this.databaseService.schema.subOrders)
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.subOrders.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(eq(this.databaseService.schema.subOrders.id, input.subOrderId))
      .limit(1);

    if (!subOrder) {
      throw new NotFoundException(`Sub-order with ID ${input.subOrderId} not found`);
    }

    if (subOrder.parentCustomerId !== customerId) {
      throw new ForbiddenException('Cannot file a dispute on an order placed by another customer');
    }

    // 2. Over-claim protection: Claimed amount cannot exceed sub-order total
    const subOrderTotalMinor =
      subOrder.itemSubtotalMinor + subOrder.shippingFeeMinor + subOrder.taxMinor;

    if (input.claimedAmountMinor > subOrderTotalMinor) {
      throw new BadRequestException(
        `Claimed amount (${input.claimedAmountMinor}) exceeds total sub-order value (${subOrderTotalMinor})`,
      );
    }

    // 3. Deduplication check: Cannot file multiple active disputes for the same sub-order
    const [existingDispute] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.disputes)
      .where(
        and(
          eq(this.databaseService.schema.disputes.subOrderId, input.subOrderId),
          sql`${this.databaseService.schema.disputes.status} IN ('OPEN', 'UNDER_REVIEW')`,
        ),
      )
      .limit(1);

    if (existingDispute) {
      throw new BadRequestException(
        `An active dispute (${existingDispute.disputeNumber}) already exists for this sub-order`,
      );
    }

    const disputeNumber = `DISP-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`;

    const [dispute] = await this.databaseService.db
      .insert(this.databaseService.schema.disputes)
      .values({
        disputeNumber,
        subOrderId: input.subOrderId,
        customerId,
        sellerId: subOrder.sellerId,
        reason: input.reason,
        claimedAmountMinor: input.claimedAmountMinor,
        status: 'OPEN',
        customerNotes: input.customerNotes,
        evidenceUrls: input.evidenceUrls ?? [],
      })
      .returning();

    if (!dispute) {
      throw new BadRequestException('Failed to create dispute');
    }

    // Log timeline event on the sub-order
    await this.databaseService.db.insert(this.databaseService.schema.orderTimelineEvents).values({
      subOrderId: input.subOrderId,
      fromStatus: subOrder.status,
      toStatus: subOrder.status,
      actorId: customerId,
      notes: `Dispute ${dispute.disputeNumber} filed by customer: ${input.reason}`,
    });

    await this.auditService.logEvent({
      actorId: customerId,
      actorRole: 'CUSTOMER',
      action: 'DISPUTE_OPENED',
      resourceType: 'DISPUTE',
      resourceId: dispute.id,
      metadata: {
        disputeNumber: dispute.disputeNumber,
        subOrderId: input.subOrderId,
        claimedAmountMinor: input.claimedAmountMinor,
      },
    });

    return this.getDispute(dispute.id, customerId, 'CUSTOMER');
  }

  /**
   * Retrieves a paginated list of disputes with tenant isolation.
   */
  async listDisputes(
    actorId: string,
    role: string,
    query: DisputeQuery,
  ): Promise<PaginatedDisputesDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Tenancy isolation
    if (role === 'CUSTOMER') {
      conditions.push(eq(this.databaseService.schema.disputes.customerId, actorId));
    } else if (role === 'SELLER') {
      const [sellerProfile] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.sellerProfiles)
        .where(eq(this.databaseService.schema.sellerProfiles.userId, actorId))
        .limit(1);

      if (!sellerProfile) {
        return { disputes: [], total: 0, page, limit, totalPages: 0 };
      }
      conditions.push(eq(this.databaseService.schema.disputes.sellerId, sellerProfile.id));
    }

    if (query.status) {
      conditions.push(eq(this.databaseService.schema.disputes.status, query.status));
    }

    if (query.reason) {
      conditions.push(eq(this.databaseService.schema.disputes.reason, query.reason));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.databaseService.db
      .select({ total: sql<number>`count(*)` })
      .from(this.databaseService.schema.disputes)
      .where(whereClause);

    const total = Number(countResult?.total ?? 0);

    const rows = await this.databaseService.db
      .select({
        id: this.databaseService.schema.disputes.id,
        disputeNumber: this.databaseService.schema.disputes.disputeNumber,
        subOrderId: this.databaseService.schema.disputes.subOrderId,
        subOrderNumber: this.databaseService.schema.subOrders.subOrderNumber,
        customerId: this.databaseService.schema.disputes.customerId,
        customerFirstName: this.databaseService.schema.users.firstName,
        customerLastName: this.databaseService.schema.users.lastName,
        sellerId: this.databaseService.schema.disputes.sellerId,
        shopName: this.databaseService.schema.shops.name,
        reason: this.databaseService.schema.disputes.reason,
        claimedAmountMinor: this.databaseService.schema.disputes.claimedAmountMinor,
        currency: this.databaseService.schema.subOrders.currency,
        status: this.databaseService.schema.disputes.status,
        resolution: this.databaseService.schema.disputes.resolution,
        createdAt: this.databaseService.schema.disputes.createdAt,
      })
      .from(this.databaseService.schema.disputes)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.disputes.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.disputes.customerId, this.databaseService.schema.users.id),
      )
      .innerJoin(
        this.databaseService.schema.shops,
        eq(this.databaseService.schema.subOrders.shopId, this.databaseService.schema.shops.id),
      )
      .where(whereClause)
      .orderBy(desc(this.databaseService.schema.disputes.createdAt))
      .limit(limit)
      .offset(offset);

    const disputes: DisputeListItemDto[] = rows.map((r) => ({
      id: r.id,
      disputeNumber: r.disputeNumber,
      subOrderId: r.subOrderId,
      subOrderNumber: r.subOrderNumber,
      customerId: r.customerId,
      customerName: `${r.customerFirstName} ${r.customerLastName}`.trim(),
      sellerId: r.sellerId,
      shopName: r.shopName,
      reason: r.reason,
      claimedAmountMinor: r.claimedAmountMinor,
      currency: r.currency,
      status: r.status,
      resolution: r.resolution,
      createdAt: r.createdAt.toISOString(),
    }));

    return {
      disputes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Retrieves single dispute details with object-level authorization.
   */
  async getDispute(disputeId: string, actorId: string, role: string): Promise<DisputeDetailDto> {
    const [dispute] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.disputes.id,
        disputeNumber: this.databaseService.schema.disputes.disputeNumber,
        subOrderId: this.databaseService.schema.disputes.subOrderId,
        subOrderNumber: this.databaseService.schema.subOrders.subOrderNumber,
        customerId: this.databaseService.schema.disputes.customerId,
        customerFirstName: this.databaseService.schema.users.firstName,
        customerLastName: this.databaseService.schema.users.lastName,
        sellerId: this.databaseService.schema.disputes.sellerId,
        shopName: this.databaseService.schema.shops.name,
        reason: this.databaseService.schema.disputes.reason,
        claimedAmountMinor: this.databaseService.schema.disputes.claimedAmountMinor,
        currency: this.databaseService.schema.subOrders.currency,
        status: this.databaseService.schema.disputes.status,
        resolution: this.databaseService.schema.disputes.resolution,
        customerNotes: this.databaseService.schema.disputes.customerNotes,
        sellerNotes: this.databaseService.schema.disputes.sellerNotes,
        evidenceUrls: this.databaseService.schema.disputes.evidenceUrls,
        resolutionNotes: this.databaseService.schema.disputes.resolutionNotes,
        resolvedBy: this.databaseService.schema.disputes.resolvedBy,
        resolvedAt: this.databaseService.schema.disputes.resolvedAt,
        createdAt: this.databaseService.schema.disputes.createdAt,
        updatedAt: this.databaseService.schema.disputes.updatedAt,
      })
      .from(this.databaseService.schema.disputes)
      .innerJoin(
        this.databaseService.schema.subOrders,
        eq(
          this.databaseService.schema.disputes.subOrderId,
          this.databaseService.schema.subOrders.id,
        ),
      )
      .innerJoin(
        this.databaseService.schema.users,
        eq(this.databaseService.schema.disputes.customerId, this.databaseService.schema.users.id),
      )
      .innerJoin(
        this.databaseService.schema.shops,
        eq(this.databaseService.schema.subOrders.shopId, this.databaseService.schema.shops.id),
      )
      .where(eq(this.databaseService.schema.disputes.id, disputeId))
      .limit(1);

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    const isStaff = this.isInternalStaff(role);

    // Tenant authorization check
    if (!isStaff) {
      if (role === 'CUSTOMER' && dispute.customerId !== actorId) {
        throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
      }
      if (role === 'SELLER') {
        const [sellerProfile] = await this.databaseService.db
          .select()
          .from(this.databaseService.schema.sellerProfiles)
          .where(eq(this.databaseService.schema.sellerProfiles.userId, actorId))
          .limit(1);

        if (!sellerProfile || dispute.sellerId !== sellerProfile.id) {
          throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
        }
      }
    }

    return {
      id: dispute.id,
      disputeNumber: dispute.disputeNumber,
      subOrderId: dispute.subOrderId,
      subOrderNumber: dispute.subOrderNumber,
      customerId: dispute.customerId,
      customerName: `${dispute.customerFirstName} ${dispute.customerLastName}`.trim(),
      sellerId: dispute.sellerId,
      shopName: dispute.shopName,
      reason: dispute.reason,
      claimedAmountMinor: dispute.claimedAmountMinor,
      currency: dispute.currency,
      status: dispute.status,
      resolution: dispute.resolution,
      customerNotes: dispute.customerNotes,
      sellerNotes: dispute.sellerNotes,
      evidenceUrls: dispute.evidenceUrls ?? [],
      resolutionNotes: dispute.resolutionNotes,
      resolvedBy: dispute.resolvedBy,
      resolvedAt: dispute.resolvedAt ? dispute.resolvedAt.toISOString() : null,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
    };
  }

  /**
   * Submits seller's explanation and counter-evidence for an open dispute.
   */
  async submitSellerResponse(
    disputeId: string,
    sellerUserId: string,
    input: SellerDisputeResponseInput,
  ): Promise<DisputeDetailDto> {
    const [sellerProfile] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, sellerUserId))
      .limit(1);

    if (!sellerProfile) {
      throw new ForbiddenException('Only registered artisans can respond to disputes');
    }

    const [dispute] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.disputes)
      .where(eq(this.databaseService.schema.disputes.id, disputeId))
      .limit(1);

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    if (dispute.sellerId !== sellerProfile.id) {
      throw new ForbiddenException('Cannot respond to a dispute against another seller');
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      throw new BadRequestException('Cannot respond to an already resolved dispute');
    }

    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.disputes)
      .set({
        sellerNotes: input.sellerNotes,
        evidenceUrls: input.evidenceUrls ?? dispute.evidenceUrls,
        status: 'UNDER_REVIEW',
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.disputes.id, disputeId));

    await this.auditService.logEvent({
      actorId: sellerUserId,
      actorRole: 'SELLER',
      action: 'DISPUTE_SELLER_RESPONDED',
      resourceType: 'DISPUTE',
      resourceId: disputeId,
      metadata: {
        disputeNumber: dispute.disputeNumber,
      },
    });

    return this.getDispute(disputeId, sellerUserId, 'SELLER');
  }

  /**
   * Resolves a dispute with financial reconciliation.
   * FINANCIAL INVARIANT: If resolution involves a refund, it invokes the authoritative
   * PaymentsService.requestRefund and processRefund pipeline to preserve balanced ledger invariants!
   */
  async resolveDispute(
    disputeId: string,
    staffId: string,
    staffRole: string,
    input: ResolveDisputeInput,
  ): Promise<DisputeDetailDto> {
    if (!this.isInternalStaff(staffRole)) {
      throw new ForbiddenException(
        'Only internal platform staff are authorized to arbitrate disputes',
      );
    }

    const [dispute] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.disputes)
      .where(eq(this.databaseService.schema.disputes.id, disputeId))
      .limit(1);

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
      throw new BadRequestException('Dispute is already resolved');
    }

    // 1. Authoritative Financial Processing
    if (input.resolution === 'FULL_REFUND' || input.resolution === 'PARTIAL_REFUND') {
      const refundAmountMinor = input.refundAmountMinor ?? dispute.claimedAmountMinor;

      if (refundAmountMinor <= 0) {
        throw new BadRequestException('Refund amount must be greater than 0');
      }

      // Request and process refund via authoritative G09 PaymentsService (enforces double-entry ledger balance)
      const refundRequest = await this.paymentsService.requestRefund(staffId, {
        subOrderId: dispute.subOrderId,
        amountMinor: refundAmountMinor,
        reason: 'DISPUTE_RESOLUTION',
      });

      await this.paymentsService.processRefund(staffId, refundRequest.id, {
        approved: true,
      });
    }

    // 2. Update dispute status and record arbitration notes
    const now = new Date();

    await this.databaseService.db
      .update(this.databaseService.schema.disputes)
      .set({
        status: 'RESOLVED',
        resolution: input.resolution,
        resolutionNotes: input.resolutionNotes,
        resolvedBy: staffId,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(this.databaseService.schema.disputes.id, disputeId));

    // 3. Log sub-order timeline event
    await this.databaseService.db.insert(this.databaseService.schema.orderTimelineEvents).values({
      subOrderId: dispute.subOrderId,
      fromStatus: 'DELIVERED',
      toStatus: 'DELIVERED',
      actorId: staffId,
      notes: `Dispute ${dispute.disputeNumber} arbitrated by staff: ${input.resolution} - ${input.resolutionNotes}`,
    });

    // 4. Audit Log
    await this.auditService.logEvent({
      actorId: staffId,
      actorRole: staffRole,
      action: 'DISPUTE_RESOLVED',
      resourceType: 'DISPUTE',
      resourceId: disputeId,
      metadata: {
        disputeNumber: dispute.disputeNumber,
        resolution: input.resolution,
        refundAmountMinor: input.refundAmountMinor ?? null,
      },
    });

    return this.getDispute(disputeId, staffId, staffRole);
  }
}
