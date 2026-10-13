import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type { ListSellerOrdersQuery, UpdateSubOrderStatusInput } from '@repo/validation';
import type {
  SellerSubOrderListResponseDto,
  SellerSubOrderDetailDto,
  SellerSubOrderSummaryDto,
  SellerSubOrderItemDto,
} from '@repo/api-contracts';

interface AddressSnapshot {
  recipientName?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

@Injectable()
export class SellerOrdersService {
  private readonly logger = new Logger(SellerOrdersService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper to resolve the authenticated user's seller profile.
   */
  async getSellerByUserId(userId: string) {
    const [seller] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.sellerProfiles.id,
        verificationStatus: this.databaseService.schema.sellerProfiles.verificationStatus,
      })
      .from(this.databaseService.schema.sellerProfiles)
      .where(eq(this.databaseService.schema.sellerProfiles.userId, userId))
      .limit(1);

    if (!seller) {
      throw new ForbiddenException('Seller profile not found for authenticated user');
    }
    return seller;
  }

  /**
   * Lists sub-orders belonging strictly to the authenticated seller.
   * Multi-seller isolation: Guarantees zero exposure of other sellers' items or figures.
   */
  async listSellerOrders(
    userId: string,
    query: ListSellerOrdersQuery,
  ): Promise<SellerSubOrderListResponseDto> {
    const seller = await this.getSellerByUserId(userId);

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(this.databaseService.schema.subOrders.sellerId, seller.id)];

    if (query.status && query.status !== 'ALL') {
      conditions.push(eq(this.databaseService.schema.subOrders.status, query.status));
    }

    if (query.search) {
      conditions.push(
        ilike(this.databaseService.schema.subOrders.subOrderNumber, `%${query.search}%`),
      );
    }

    // 1. Total count query
    const [countResult] = await this.databaseService.db
      .select({ total: sql<number>`count(*)::int` })
      .from(this.databaseService.schema.subOrders)
      .where(and(...conditions));

    const total = countResult?.total ?? 0;

    // 2. Fetch paginated sub-orders
    const rows = await this.databaseService.db
      .select({
        subOrder: this.databaseService.schema.subOrders,
        parentOrderNumber: this.databaseService.schema.customerOrders.orderNumber,
        parentPaymentStatus: this.databaseService.schema.customerOrders.paymentStatus,
        shippingAddress: this.databaseService.schema.customerOrders.shippingAddress,
      })
      .from(this.databaseService.schema.subOrders)
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.subOrders.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(and(...conditions))
      .orderBy(desc(this.databaseService.schema.subOrders.createdAt))
      .limit(limit)
      .offset(offset);

    // 3. Aggregate item counts for the returned sub-orders
    const subOrderIds = rows.map((r) => r.subOrder.id);
    const itemCounts = new Map<string, number>();

    if (subOrderIds.length > 0) {
      const counts = await this.databaseService.db
        .select({
          subOrderId: this.databaseService.schema.orderItems.subOrderId,
          count: sql<number>`count(${this.databaseService.schema.orderItems.id})::int`,
        })
        .from(this.databaseService.schema.orderItems)
        .where(
          and(
            inArray(this.databaseService.schema.orderItems.subOrderId, subOrderIds),
            eq(this.databaseService.schema.orderItems.sellerId, seller.id),
          ),
        )
        .groupBy(this.databaseService.schema.orderItems.subOrderId);

      for (const c of counts) {
        itemCounts.set(c.subOrderId, c.count);
      }
    }

    const items: SellerSubOrderSummaryDto[] = rows.map((r) => {
      const address = (r.shippingAddress as AddressSnapshot) || {};
      return {
        id: r.subOrder.id,
        subOrderNumber: r.subOrder.subOrderNumber,
        parentOrderNumber: r.parentOrderNumber,
        status: r.subOrder.status,
        itemSubtotalMinor: r.subOrder.itemSubtotalMinor,
        shippingFeeMinor: r.subOrder.shippingFeeMinor,
        commissionFeeMinor: r.subOrder.commissionFeeMinor,
        netSellerPayableMinor: r.subOrder.netSellerPayableMinor,
        currency: r.subOrder.currency,
        createdAt: r.subOrder.createdAt.toISOString(),
        parentPaymentStatus: r.parentPaymentStatus,
        itemCount: itemCounts.get(r.subOrder.id) || 1,
        // Redacted destination for summary list (privacy protection)
        recipientCity: address.city || 'Jaipur',
        recipientState: address.state || 'Rajasthan',
        recipientPostalCode: address.postalCode || '302001',
      };
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves full details for a seller's specific sub-order.
   * Strictly enforces seller ownership: Attempting to access another seller's suborder returns 404.
   */
  async getSellerOrderDetail(userId: string, subOrderId: string): Promise<SellerSubOrderDetailDto> {
    const seller = await this.getSellerByUserId(userId);

    const [row] = await this.databaseService.db
      .select({
        subOrder: this.databaseService.schema.subOrders,
        parentOrderNumber: this.databaseService.schema.customerOrders.orderNumber,
        parentPaymentStatus: this.databaseService.schema.customerOrders.paymentStatus,
        parentOrderStatus: this.databaseService.schema.customerOrders.orderStatus,
        shippingAddress: this.databaseService.schema.customerOrders.shippingAddress,
        customerNote: this.databaseService.schema.customerOrders.customerNote,
      })
      .from(this.databaseService.schema.subOrders)
      .innerJoin(
        this.databaseService.schema.customerOrders,
        eq(
          this.databaseService.schema.subOrders.parentOrderId,
          this.databaseService.schema.customerOrders.id,
        ),
      )
      .where(
        and(
          eq(this.databaseService.schema.subOrders.id, subOrderId),
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(
        `Sub-order ${subOrderId} not found or not owned by the authenticated seller`,
      );
    }

    // 2. Fetch line items (restricted to sellerId)
    const itemRows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.orderItems)
      .where(
        and(
          eq(this.databaseService.schema.orderItems.subOrderId, subOrderId),
          eq(this.databaseService.schema.orderItems.sellerId, seller.id),
        ),
      );

    const items: SellerSubOrderItemDto[] = itemRows.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      titleSnapshot: item.titleSnapshot,
      skuSnapshot: item.skuSnapshot,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      totalPriceMinor: item.totalPriceMinor,
      customizationInput: item.customizationInput,
    }));

    // 3. Fetch order timeline events
    const timelineRows = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.orderTimelineEvents)
      .where(eq(this.databaseService.schema.orderTimelineEvents.subOrderId, subOrderId))
      .orderBy(this.databaseService.schema.orderTimelineEvents.createdAt);

    const address = (row.shippingAddress as AddressSnapshot) || {};

    return {
      id: row.subOrder.id,
      subOrderNumber: row.subOrder.subOrderNumber,
      parentOrderNumber: row.parentOrderNumber,
      status: row.subOrder.status,
      itemSubtotalMinor: row.subOrder.itemSubtotalMinor,
      shippingFeeMinor: row.subOrder.shippingFeeMinor,
      commissionFeeMinor: row.subOrder.commissionFeeMinor,
      netSellerPayableMinor: row.subOrder.netSellerPayableMinor,
      currency: row.subOrder.currency,
      createdAt: row.subOrder.createdAt.toISOString(),
      cancelledAt: row.subOrder.cancelledAt?.toISOString() || null,
      cancellationReason: row.subOrder.cancellationReason,
      completedAt: row.subOrder.completedAt?.toISOString() || null,
      parentPaymentStatus: row.parentPaymentStatus,
      parentOrderStatus: row.parentOrderStatus,
      customerNote: row.customerNote,
      shippingAddress: {
        recipientName: address.recipientName || 'Customer',
        line1: address.line1,
        city: address.city || 'Jaipur',
        state: address.state || 'Rajasthan',
        postalCode: address.postalCode || '302001',
        country: address.country || 'IN',
      },
      items,
      timeline: timelineRows.map((t) => ({
        id: t.id,
        fromStatus: t.fromStatus,
        toStatus: t.toStatus,
        notes: t.notes,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Executes permitted seller order state machine transitions:
   * - CONFIRMED -> IN_PRODUCTION (Artisan begins crafting / production)
   * - IN_PRODUCTION -> READY_FOR_PICKUP (Item crafted and packaged for courier pickup)
   * - CONFIRMED or IN_PRODUCTION -> CANCELLED (Order cancelled by artisan with reason)
   */
  async updateSubOrderStatus(
    userId: string,
    subOrderId: string,
    input: UpdateSubOrderStatusInput,
  ): Promise<SellerSubOrderDetailDto> {
    const seller = await this.getSellerByUserId(userId);

    const [subOrder] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.subOrders)
      .where(
        and(
          eq(this.databaseService.schema.subOrders.id, subOrderId),
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
        ),
      )
      .limit(1);

    if (!subOrder) {
      throw new NotFoundException(
        `Sub-order ${subOrderId} not found or not owned by authenticated seller`,
      );
    }

    const currentStatus = subOrder.status;
    const targetStatus = input.status;

    // Validate state machine rules
    const isValidTransition =
      (currentStatus === 'CONFIRMED' && targetStatus === 'IN_PRODUCTION') ||
      (currentStatus === 'IN_PRODUCTION' && targetStatus === 'READY_FOR_PICKUP') ||
      ((currentStatus === 'CONFIRMED' || currentStatus === 'IN_PRODUCTION') &&
        targetStatus === 'CANCELLED');

    if (!isValidTransition) {
      throw new BadRequestException(
        `Invalid sub-order transition: cannot change status from '${currentStatus}' to '${targetStatus}'. Permitted transitions: CONFIRMED -> IN_PRODUCTION -> READY_FOR_PICKUP, or cancellation.`,
      );
    }

    const now = new Date();
    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updatedAt: now,
    };

    if (targetStatus === 'CANCELLED') {
      updatePayload['cancelledAt'] = now;
      updatePayload['cancellationReason'] = input.cancellationReason;
    }

    // Atomic transaction: update status and insert timeline event
    await this.databaseService.db.transaction(async (tx) => {
      await tx
        .update(this.databaseService.schema.subOrders)
        .set(updatePayload)
        .where(eq(this.databaseService.schema.subOrders.id, subOrderId));

      await tx.insert(this.databaseService.schema.orderTimelineEvents).values({
        subOrderId,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        actorId: userId,
        notes:
          input.notes ||
          (targetStatus === 'CANCELLED'
            ? `Cancelled by artisan: ${input.cancellationReason}`
            : `Status updated to ${targetStatus} by artisan`),
      });
    });

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'APPROVED_SELLER',
      action: 'SELLER_SUB_ORDER_STATUS_UPDATED',
      resourceType: 'SUB_ORDER',
      resourceId: subOrderId,
      metadata: {
        fromStatus: currentStatus,
        toStatus: targetStatus,
        subOrderNumber: subOrder.subOrderNumber,
      },
    });

    this.logger.log(
      `Seller ${seller.id} transitioned sub-order ${subOrder.subOrderNumber} from ${currentStatus} to ${targetStatus}`,
    );

    return this.getSellerOrderDetail(userId, subOrderId);
  }
}
