import { Injectable, Inject } from '@nestjs/common';
import { eq, sql, desc } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { ReconciliationService } from '../payments/reconciliation.service';
import type { AdminDashboardMetricsDto, AdminAuditLogListItemDto } from '@repo/api-contracts';

@Injectable()
export class AdminDashboardService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(ReconciliationService)
    private readonly reconciliationService: ReconciliationService,
  ) {}

  /**
   * Authoritatively computes operational and business metrics across all marketplace domains.
   * Eliminates simulated stats by querying PostgreSQL aggregates directly.
   */
  async getMetrics(): Promise<AdminDashboardMetricsDto> {
    const db = this.databaseService.db;
    const schema = this.databaseService.schema;

    // 1. Sellers metrics
    const [sellerStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pendingVerification: sql<number>`count(case when ${schema.sellerProfiles.verificationStatus} = 'PENDING_REVIEW' then 1 end)::int`,
        approved: sql<number>`count(case when ${schema.sellerProfiles.verificationStatus} = 'VERIFIED' then 1 end)::int`,
        suspended: sql<number>`count(case when ${schema.sellerProfiles.verificationStatus} = 'SUSPENDED' then 1 end)::int`,
      })
      .from(schema.sellerProfiles);

    // 2. Product Moderation & Catalog metrics
    const [productStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pendingModeration: sql<number>`count(case when ${schema.products.moderationStatus} = 'PENDING_REVIEW' then 1 end)::int`,
        published: sql<number>`count(case when ${schema.products.moderationStatus} = 'PUBLISHED' then 1 end)::int`,
        rejected: sql<number>`count(case when ${schema.products.moderationStatus} = 'REJECTED' then 1 end)::int`,
      })
      .from(schema.products);

    // 3. Orders metrics
    const [orderStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(case when ${schema.customerOrders.orderStatus} = 'PLACED' then 1 end)::int`,
        processing: sql<number>`count(case when ${schema.customerOrders.orderStatus} = 'PROCESSING' or ${schema.customerOrders.orderStatus} = 'PARTIALLY_SHIPPED' then 1 end)::int`,
        completed: sql<number>`count(case when ${schema.customerOrders.orderStatus} = 'COMPLETED' then 1 end)::int`,
        cancelled: sql<number>`count(case when ${schema.customerOrders.orderStatus} = 'CANCELLED' then 1 end)::int`,
        gmv: sql<number>`coalesce(sum(${schema.customerOrders.totalAmountMinor}), 0)::bigint`,
      })
      .from(schema.customerOrders);

    // 4. Shipment and Fulfilment metrics
    const [shipmentStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pendingPickup: sql<number>`count(case when ${schema.shipments.status} in ('LABEL_CREATED', 'PICKUP_SCHEDULED') then 1 end)::int`,
        inTransit: sql<number>`count(case when ${schema.shipments.status} in ('IN_TRANSIT', 'OUT_FOR_DELIVERY') then 1 end)::int`,
        delivered: sql<number>`count(case when ${schema.shipments.status} in ('DELIVERED', 'RTO_DELIVERED') then 1 end)::int`,
        exceptions: sql<number>`count(case when ${schema.shipments.status} in ('DELIVERY_FAILED', 'RTO_INITIATED', 'CANCELLED') then 1 end)::int`,
      })
      .from(schema.shipments);

    // 5. Finances & Ledger metrics
    const [capturedStats] = await db
      .select({
        capturedTotal: sql<number>`coalesce(sum(${schema.paymentAttempts.amountMinor}), 0)::bigint`,
      })
      .from(schema.paymentAttempts)
      .where(eq(schema.paymentAttempts.status, 'SUCCEEDED'));

    const [commissionStats] = await db
      .select({
        totalCommission: sql<number>`coalesce(sum(${schema.subOrders.commissionFeeMinor}), 0)::bigint`,
        totalArtisanPayables: sql<number>`coalesce(sum(${schema.subOrders.netSellerPayableMinor}), 0)::bigint`,
      })
      .from(schema.subOrders);

    // Run reconciliation check for discrepancy counter
    let discrepancyCount = 0;
    try {
      const recon = await this.reconciliationService.runReconciliationAudit();
      discrepancyCount = recon.discrepancies.length;
    } catch {
      discrepancyCount = 0;
    }

    // 6. Recent Audit Events (last 10 events)
    const recentLogs = await db
      .select({
        id: schema.auditLogs.id,
        actorId: schema.auditLogs.actorId,
        actorRole: schema.auditLogs.actorRole,
        action: schema.auditLogs.action,
        resourceType: schema.auditLogs.resourceType,
        resourceId: schema.auditLogs.resourceId,
        ipAddress: schema.auditLogs.ipAddress,
        createdAt: schema.auditLogs.createdAt,
      })
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(10);

    const formattedRecentLogs: AdminAuditLogListItemDto[] = recentLogs.map((log) => ({
      id: log.id,
      actorId: log.actorId,
      actorRole: log.actorRole,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      sellers: {
        total: Number(sellerStats?.total ?? 0),
        pendingVerification: Number(sellerStats?.pendingVerification ?? 0),
        approved: Number(sellerStats?.approved ?? 0),
        suspended: Number(sellerStats?.suspended ?? 0),
      },
      products: {
        total: Number(productStats?.total ?? 0),
        pendingModeration: Number(productStats?.pendingModeration ?? 0),
        published: Number(productStats?.published ?? 0),
        rejected: Number(productStats?.rejected ?? 0),
      },
      orders: {
        total: Number(orderStats?.total ?? 0),
        pending: Number(orderStats?.pending ?? 0),
        processing: Number(orderStats?.processing ?? 0),
        completed: Number(orderStats?.completed ?? 0),
        cancelled: Number(orderStats?.cancelled ?? 0),
        grossMerchandiseValueMinor: Number(orderStats?.gmv ?? 0),
      },
      fulfilment: {
        totalShipments: Number(shipmentStats?.total ?? 0),
        pendingPickup: Number(shipmentStats?.pendingPickup ?? 0),
        inTransit: Number(shipmentStats?.inTransit ?? 0),
        delivered: Number(shipmentStats?.delivered ?? 0),
        deliveryExceptions: Number(shipmentStats?.exceptions ?? 0),
      },
      finances: {
        capturedPaymentsMinor: Number(capturedStats?.capturedTotal ?? 0),
        platformCommissionsMinor: Number(commissionStats?.totalCommission ?? 0),
        sellerPayablesMinor: Number(commissionStats?.totalArtisanPayables ?? 0),
        reconciliationDiscrepancies: discrepancyCount,
      },
      recentAuditLogs: formattedRecentLogs,
    };
  }
}
