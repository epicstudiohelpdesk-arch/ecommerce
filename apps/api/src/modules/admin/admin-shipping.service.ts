import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { eq, sql, and, desc, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { AdminShipmentQuery } from '@repo/validation';
import type {
  PaginatedAdminShipmentsDto,
  AdminShipmentListItemDto,
  AdminShipmentDetailDto,
} from '@repo/api-contracts';

@Injectable()
export class AdminShippingService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Lists shipments across all artisan sellers with courier, status, and exception filters.
   */
  async listShipments(query: AdminShipmentQuery): Promise<PaginatedAdminShipmentsDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    if (query.status) {
      conditions.push(eq(schema.shipments.status, query.status));
    }

    if (query.carrier) {
      conditions.push(eq(schema.shipments.courierCode, query.carrier));
    }

    if (query.hasException) {
      conditions.push(
        or(
          eq(schema.shipments.status, 'DELIVERY_FAILED'),
          eq(schema.shipments.status, 'CANCELLED'),
          eq(schema.shipments.status, 'RTO_INITIATED'),
        ),
      );
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        sql`(${schema.shipments.waybillNumber} ILIKE ${term} OR ${schema.shipments.trackingNumber} ILIKE ${term} OR ${schema.subOrders.subOrderNumber} ILIKE ${term} OR ${schema.sellerProfiles.legalName} ILIKE ${term} OR ${schema.shops.name} ILIKE ${term})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.shipments)
      .innerJoin(schema.subOrders, eq(schema.shipments.subOrderId, schema.subOrders.id))
      .innerJoin(schema.sellerProfiles, eq(schema.subOrders.sellerId, schema.sellerProfiles.id))
      .innerJoin(schema.shops, eq(schema.subOrders.shopId, schema.shops.id))
      .where(whereClause);

    const total = Number(countResult?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    // Rows
    const rows = await db
      .select({
        id: schema.shipments.id,
        waybillNumber: schema.shipments.waybillNumber,
        trackingNumber: schema.shipments.trackingNumber,
        carrier: schema.shipments.courierCode,
        status: schema.shipments.status,
        subOrderId: schema.shipments.subOrderId,
        subOrderNumber: schema.subOrders.subOrderNumber,
        sellerId: schema.subOrders.sellerId,
        sellerName: schema.sellerProfiles.legalName,
        shopName: schema.shops.name,
        deliveryAddressSnapshot: schema.shipments.deliveryAddressSnapshot,
        pickupDate: schema.shipments.pickupDate,
        createdAt: schema.shipments.createdAt,
        updatedAt: schema.shipments.updatedAt,
      })
      .from(schema.shipments)
      .innerJoin(schema.subOrders, eq(schema.shipments.subOrderId, schema.subOrders.id))
      .innerJoin(schema.sellerProfiles, eq(schema.subOrders.sellerId, schema.sellerProfiles.id))
      .innerJoin(schema.shops, eq(schema.subOrders.shopId, schema.shops.id))
      .where(whereClause)
      .orderBy(desc(schema.shipments.createdAt))
      .limit(limit)
      .offset(offset);

    const items: AdminShipmentListItemDto[] = rows.map((r) => {
      const addr = (r.deliveryAddressSnapshot ?? {}) as Record<string, string>;
      return {
        id: r.id,
        waybillNumber: r.waybillNumber,
        trackingNumber: r.trackingNumber,
        carrier: r.carrier,
        status: r.status,
        subOrderId: r.subOrderId,
        subOrderNumber: r.subOrderNumber,
        sellerId: r.sellerId,
        sellerName: r.sellerName,
        shopName: r.shopName,
        destinationCity: addr['city'] ?? 'Unknown',
        destinationPincode: addr['postalCode'] ?? addr['pincode'] ?? 'Unknown',
        pickupDate: r.pickupDate ? r.pickupDate.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return {
      items,
      meta: { page, limit, total, totalPages },
    };
  }

  /**
   * Retrieves comprehensive carrier tracking events, package dimensions, and snapshots for a shipment.
   */
  async getShipmentDetail(shipmentId: string): Promise<AdminShipmentDetailDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    const [row] = await db
      .select({
        id: schema.shipments.id,
        waybillNumber: schema.shipments.waybillNumber,
        trackingNumber: schema.shipments.trackingNumber,
        carrier: schema.shipments.courierCode,
        status: schema.shipments.status,
        subOrderId: schema.shipments.subOrderId,
        subOrderNumber: schema.subOrders.subOrderNumber,
        sellerId: schema.subOrders.sellerId,
        sellerName: schema.sellerProfiles.legalName,
        shopName: schema.shops.name,
        weightGrams: schema.shipments.weightGrams,
        lengthMm: schema.shipments.lengthMm,
        widthMm: schema.shipments.widthMm,
        heightMm: schema.shipments.heightMm,
        pickupAddressSnapshot: schema.shipments.pickupAddressSnapshot,
        deliveryAddressSnapshot: schema.shipments.deliveryAddressSnapshot,
        carrierMetadata: schema.shipments.carrierMetadata,
        pickupDate: schema.shipments.pickupDate,
        cancellationReason: schema.shipments.cancellationReason,
        createdAt: schema.shipments.createdAt,
        updatedAt: schema.shipments.updatedAt,
      })
      .from(schema.shipments)
      .innerJoin(schema.subOrders, eq(schema.shipments.subOrderId, schema.subOrders.id))
      .innerJoin(schema.sellerProfiles, eq(schema.subOrders.sellerId, schema.sellerProfiles.id))
      .innerJoin(schema.shops, eq(schema.subOrders.shopId, schema.shops.id))
      .where(
        or(
          eq(schema.shipments.id, shipmentId),
          eq(schema.shipments.waybillNumber, shipmentId),
          eq(schema.shipments.trackingNumber, shipmentId),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Shipment ${shipmentId} not found`);
    }

    // Query Milestones
    const milestones = await db
      .select({
        id: schema.shipmentMilestones.id,
        status: schema.shipmentMilestones.status,
        location: schema.shipmentMilestones.location,
        description: schema.shipmentMilestones.description,
        eventTime: schema.shipmentMilestones.eventTime,
        rawPayload: schema.shipmentMilestones.rawPayload,
      })
      .from(schema.shipmentMilestones)
      .where(eq(schema.shipmentMilestones.shipmentId, row.id))
      .orderBy(desc(schema.shipmentMilestones.eventTime));

    const addr = (row.deliveryAddressSnapshot ?? {}) as Record<string, string>;

    const events = milestones.map((m) => {
      const raw = (m.rawPayload ?? {}) as Record<string, string>;
      return {
        status: m.status,
        location: m.location ?? undefined,
        timestamp: m.eventTime.toISOString(),
        description: m.description,
        rawCourierStatus: raw['courierStatus'] ?? raw['status'],
      };
    });

    return {
      id: row.id,
      waybillNumber: row.waybillNumber,
      trackingNumber: row.trackingNumber,
      carrier: row.carrier,
      status: row.status,
      subOrderId: row.subOrderId,
      subOrderNumber: row.subOrderNumber,
      sellerId: row.sellerId,
      sellerName: row.sellerName,
      shopName: row.shopName,
      destinationCity: addr['city'] ?? 'Unknown',
      destinationPincode: addr['postalCode'] ?? addr['pincode'] ?? 'Unknown',
      packageWeightGrams: row.weightGrams,
      dimensions: {
        lengthCm: Math.round(row.lengthMm / 10),
        widthCm: Math.round(row.widthMm / 10),
        heightCm: Math.round(row.heightMm / 10),
      },
      pickupAddressSnapshot: (row.pickupAddressSnapshot ?? {}) as Record<string, unknown>,
      deliveryAddressSnapshot: (row.deliveryAddressSnapshot ?? {}) as Record<string, unknown>,
      trackingEvents: events,
      cancellationReason: row.cancellationReason,
      carrierMetadata: (row.carrierMetadata ?? {}) as Record<string, unknown>,
      pickupDate: row.pickupDate ? row.pickupDate.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
