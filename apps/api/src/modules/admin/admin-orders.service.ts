import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, sql, and, desc, gte, lte, or, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { AdminOrderQuery } from '@repo/validation';
import type {
  PaginatedAdminOrdersDto,
  AdminOrderListItemDto,
  AdminOrderDetailDto,
  AdminOrderSubOrderDto,
} from '@repo/api-contracts';

@Injectable()
export class AdminOrdersService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Search and list marketplace orders with bounded pagination and filter support.
   */
  async listOrders(query: AdminOrderQuery): Promise<PaginatedAdminOrdersDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.orderStatus) {
      conditions.push(eq(schema.customerOrders.orderStatus, query.orderStatus));
    }

    if (query.paymentStatus) {
      conditions.push(eq(schema.customerOrders.paymentStatus, query.paymentStatus));
    }

    if (query.startDate) {
      conditions.push(gte(schema.customerOrders.createdAt, new Date(query.startDate)));
    }

    if (query.endDate) {
      conditions.push(lte(schema.customerOrders.createdAt, new Date(query.endDate)));
    }

    if (query.search) {
      const searchTerm = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${schema.customerOrders.orderNumber} ILIKE ${searchTerm} OR ${schema.users.email} ILIKE ${searchTerm} OR ${schema.users.firstName} ILIKE ${searchTerm} OR ${schema.users.lastName} ILIKE ${searchTerm})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.customerOrders)
      .innerJoin(schema.users, eq(schema.customerOrders.customerId, schema.users.id))
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Rows query
    const orderRows = await db
      .select({
        id: schema.customerOrders.id,
        orderNumber: schema.customerOrders.orderNumber,
        customerId: schema.customerOrders.customerId,
        customerFirstName: schema.users.firstName,
        customerLastName: schema.users.lastName,
        customerEmail: schema.users.email,
        orderStatus: schema.customerOrders.orderStatus,
        paymentStatus: schema.customerOrders.paymentStatus,
        totalAmountMinor: schema.customerOrders.totalAmountMinor,
        createdAt: schema.customerOrders.createdAt,
        updatedAt: schema.customerOrders.updatedAt,
      })
      .from(schema.customerOrders)
      .innerJoin(schema.users, eq(schema.customerOrders.customerId, schema.users.id))
      .where(whereClause)
      .orderBy(desc(schema.customerOrders.createdAt))
      .limit(limit)
      .offset(offset);

    if (orderRows.length === 0) {
      return {
        items: [],
        meta: { page, limit, total, totalPages },
      };
    }

    const orderIds = orderRows.map((o) => o.id);

    // Fetch counts of sub-orders and items
    const subOrderCounts = await db
      .select({
        parentOrderId: schema.subOrders.parentOrderId,
        subOrderCount: sql<number>`count(distinct ${schema.subOrders.id})::int`,
        itemCount: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`,
      })
      .from(schema.subOrders)
      .leftJoin(schema.orderItems, eq(schema.subOrders.id, schema.orderItems.subOrderId))
      .where(inArray(schema.subOrders.parentOrderId, orderIds))
      .groupBy(schema.subOrders.parentOrderId);

    const countsMap = new Map<string, { subOrderCount: number; itemCount: number }>();
    for (const c of subOrderCounts) {
      countsMap.set(c.parentOrderId, {
        subOrderCount: Number(c.subOrderCount),
        itemCount: Number(c.itemCount),
      });
    }

    const items: AdminOrderListItemDto[] = orderRows.map((o) => {
      const counts = countsMap.get(o.id) ?? { subOrderCount: 0, itemCount: 0 };
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerId: o.customerId,
        customerName: `${o.customerFirstName} ${o.customerLastName}`.trim(),
        customerEmail: o.customerEmail,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        totalAmountMinor: Number(o.totalAmountMinor),
        subOrderCount: counts.subOrderCount,
        itemCount: counts.itemCount,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      };
    });

    return {
      items,
      meta: { page, limit, total, totalPages },
    };
  }

  /**
   * Retrieves full operational order details including artisan sub-orders, shipments, and customer info.
   */
  async getOrderDetail(orderIdOrNumber: string): Promise<AdminOrderDetailDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const [order] = await db
      .select({
        id: schema.customerOrders.id,
        orderNumber: schema.customerOrders.orderNumber,
        customerId: schema.customerOrders.customerId,
        customerFirstName: schema.users.firstName,
        customerLastName: schema.users.lastName,
        customerEmail: schema.users.email,
        orderStatus: schema.customerOrders.orderStatus,
        paymentStatus: schema.customerOrders.paymentStatus,
        totalAmountMinor: schema.customerOrders.totalAmountMinor,
        shippingAddress: schema.customerOrders.shippingAddress,
        createdAt: schema.customerOrders.createdAt,
        updatedAt: schema.customerOrders.updatedAt,
      })
      .from(schema.customerOrders)
      .innerJoin(schema.users, eq(schema.customerOrders.customerId, schema.users.id))
      .where(
        or(
          eq(schema.customerOrders.id, orderIdOrNumber),
          eq(schema.customerOrders.orderNumber, orderIdOrNumber),
        ),
      )
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order ${orderIdOrNumber} not found`);
    }

    // Fetch Sub-Orders with seller & shop names
    const subOrderRows = await db
      .select({
        id: schema.subOrders.id,
        subOrderNumber: schema.subOrders.subOrderNumber,
        sellerId: schema.subOrders.sellerId,
        sellerLegalName: schema.sellerProfiles.legalName,
        shopName: schema.shops.name,
        subOrderStatus: schema.subOrders.status,
        itemSubtotalMinor: schema.subOrders.itemSubtotalMinor,
        shippingFeeMinor: schema.subOrders.shippingFeeMinor,
        commissionFeeMinor: schema.subOrders.commissionFeeMinor,
        taxMinor: schema.subOrders.taxMinor,
        netArtisanPayableMinor: schema.subOrders.netSellerPayableMinor,
      })
      .from(schema.subOrders)
      .innerJoin(schema.sellerProfiles, eq(schema.subOrders.sellerId, schema.sellerProfiles.id))
      .innerJoin(schema.shops, eq(schema.subOrders.shopId, schema.shops.id))
      .where(eq(schema.subOrders.parentOrderId, order.id));

    const subOrderIds = subOrderRows.map((s) => s.id);

    // Fetch items for all sub-orders
    const itemsRows =
      subOrderIds.length > 0
        ? await db
            .select({
              id: schema.orderItems.id,
              subOrderId: schema.orderItems.subOrderId,
              variantId: schema.orderItems.variantId,
              title: schema.orderItems.titleSnapshot,
              sku: schema.orderItems.skuSnapshot,
              quantity: schema.orderItems.quantity,
              unitPriceMinor: schema.orderItems.unitPriceMinor,
              totalPriceMinor: schema.orderItems.totalPriceMinor,
              customizationInput: schema.orderItems.customizationInput,
            })
            .from(schema.orderItems)
            .where(inArray(schema.orderItems.subOrderId, subOrderIds))
        : [];

    // Fetch shipments for all sub-orders
    const shipmentRows =
      subOrderIds.length > 0
        ? await db
            .select({
              id: schema.shipments.id,
              subOrderId: schema.shipments.subOrderId,
              waybillNumber: schema.shipments.waybillNumber,
              trackingNumber: schema.shipments.trackingNumber,
              carrier: schema.shipments.courierCode,
              status: schema.shipments.status,
              pickupDate: schema.shipments.pickupDate,
            })
            .from(schema.shipments)
            .where(inArray(schema.shipments.subOrderId, subOrderIds))
        : [];

    const shipmentMap = new Map<string, (typeof shipmentRows)[0]>();
    for (const sh of shipmentRows) {
      shipmentMap.set(sh.subOrderId, sh);
    }

    const itemsMap = new Map<string, typeof itemsRows>();
    for (const it of itemsRows) {
      const arr = itemsMap.get(it.subOrderId) ?? [];
      arr.push(it);
      itemsMap.set(it.subOrderId, arr);
    }

    const formattedSubOrders: AdminOrderSubOrderDto[] = subOrderRows.map((s) => {
      const sItems = itemsMap.get(s.id) ?? [];
      const sh = shipmentMap.get(s.id);

      return {
        id: s.id,
        subOrderNumber: s.subOrderNumber,
        sellerId: s.sellerId,
        sellerLegalName: s.sellerLegalName,
        shopName: s.shopName,
        subOrderStatus: s.subOrderStatus,
        itemSubtotalMinor: Number(s.itemSubtotalMinor),
        shippingFeeMinor: Number(s.shippingFeeMinor),
        commissionFeeMinor: Number(s.commissionFeeMinor),
        taxMinor: Number(s.taxMinor),
        netArtisanPayableMinor: Number(s.netArtisanPayableMinor),
        payoutStatus: 'PENDING_DELIVERY',
        items: sItems.map((it) => ({
          id: it.id,
          productId: it.variantId ?? '',
          productTitle: it.title,
          variantId: it.variantId,
          sku: it.sku,
          quantity: it.quantity,
          unitPriceMinor: Number(it.unitPriceMinor),
          totalPriceMinor: Number(it.totalPriceMinor),
          customisationNote: it.customizationInput,
        })),
        shipment: sh
          ? {
              id: sh.id,
              waybillNumber: sh.waybillNumber,
              trackingNumber: sh.trackingNumber,
              carrier: sh.carrier,
              status: sh.status,
              pickupDate: sh.pickupDate ? sh.pickupDate.toISOString() : null,
            }
          : null,
      };
    });

    // Fetch Payment Attempt
    const [paymentAttempt] = await db
      .select({
        id: schema.paymentAttempts.id,
        provider: schema.paymentAttempts.provider,
        providerOrderId: schema.paymentAttempts.providerIntentId,
        amountMinor: schema.paymentAttempts.amountMinor,
        currency: schema.paymentAttempts.currency,
        status: schema.paymentAttempts.status,
        updatedAt: schema.paymentAttempts.updatedAt,
      })
      .from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.parentOrderId, order.id))
      .orderBy(desc(schema.paymentAttempts.createdAt))
      .limit(1);

    const totalItemCount = formattedSubOrders.reduce(
      (sum, so) => sum + so.items.reduce((iSum, it) => iSum + it.quantity, 0),
      0,
    );

    const rawAddress = (order.shippingAddress ?? {}) as Record<string, string>;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: `${order.customerFirstName} ${order.customerLastName}`.trim(),
      customerEmail: order.customerEmail,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmountMinor: Number(order.totalAmountMinor),
      subOrderCount: formattedSubOrders.length,
      itemCount: totalItemCount,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      shippingAddress: {
        recipientName:
          rawAddress['recipientName'] ?? `${order.customerFirstName} ${order.customerLastName}`,
        phone: rawAddress['phone'] ?? '',
        addressLine1: rawAddress['addressLine1'] ?? '',
        addressLine2: rawAddress['addressLine2'] ?? null,
        city: rawAddress['city'] ?? '',
        state: rawAddress['state'] ?? '',
        postalCode: rawAddress['postalCode'] ?? '',
        country: rawAddress['country'] ?? 'IN',
      },
      subOrders: formattedSubOrders,
      payment: paymentAttempt
        ? {
            id: paymentAttempt.id,
            provider: paymentAttempt.provider,
            providerOrderId: paymentAttempt.providerOrderId,
            amountMinor: Number(paymentAttempt.amountMinor),
            currency: paymentAttempt.currency,
            status: paymentAttempt.status,
            paymentMethod: 'GATEWAY',
            capturedAt:
              paymentAttempt.status === 'SUCCEEDED' ? paymentAttempt.updatedAt.toISOString() : null,
          }
        : null,
    };
  }
}
