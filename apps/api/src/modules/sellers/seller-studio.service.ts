import { Injectable, NotFoundException, ForbiddenException, Inject, Logger } from '@nestjs/common';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import type {
  UpdateShopProfileInput,
  SellerDashboardQuery,
  SellerAnalyticsQuery,
} from '@repo/validation';
import type {
  SellerDashboardDto,
  SellerAnalyticsPerformanceDto,
  SellerNotificationDto,
  ShopProfileDto,
  SellerActionItemDto,
  SellerRecentActivityDto,
  SellerSalesTrendPointDto,
  SellerTopProductDto,
} from '@repo/api-contracts';

@Injectable()
export class SellerStudioService {
  private readonly logger = new Logger(SellerStudioService.name);

  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Helper to verify and resolve the authenticated seller profile.
   */
  async getSellerByUserId(userId: string) {
    const [seller] = await this.databaseService.db
      .select({
        id: this.databaseService.schema.sellerProfiles.id,
        verificationStatus: this.databaseService.schema.sellerProfiles.verificationStatus,
        legalName: this.databaseService.schema.sellerProfiles.legalName,
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
   * Produces an authoritative business overview dashboard tailored for independent artisans.
   * Answers:
   * 1. How is my shop performing?
   * 2. What needs my attention?
   * 3. What is happening with my orders and products?
   * 4. What is my current financial position?
   */
  async getDashboardOverview(
    userId: string,
    query: SellerDashboardQuery,
  ): Promise<SellerDashboardDto> {
    const seller = await this.getSellerByUserId(userId);
    const period = query.period || '7d';

    // 1. Calculate timeframe start boundary
    const now = new Date();
    let startDate: Date;
    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      // 7d default
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 2. Query period sub-orders for seller
    const periodSubOrders = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.subOrders)
      .where(
        and(
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
          gte(this.databaseService.schema.subOrders.createdAt, startDate),
        ),
      );

    const ordersCount = periodSubOrders.length;
    const grossSalesMinor = periodSubOrders.reduce(
      (acc, o) => acc + o.itemSubtotalMinor + o.shippingFeeMinor,
      0,
    );
    const netPayableMinor = periodSubOrders.reduce((acc, o) => acc + o.netSellerPayableMinor, 0);

    // 3. Query all pending/actionable orders regardless of timeframe
    const [actionRequiredResult] = await this.databaseService.db
      .select({ count: sql<number>`count(*)::int` })
      .from(this.databaseService.schema.subOrders)
      .where(
        and(
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
          eq(this.databaseService.schema.subOrders.status, 'CONFIRMED'),
        ),
      );
    const actionRequiredOrdersCount = actionRequiredResult?.count ?? 0;

    // 4. Query product catalog counts
    const products = await this.databaseService.db
      .select({
        id: this.databaseService.schema.products.id,
        moderationStatus: this.databaseService.schema.products.moderationStatus,
        isActive: this.databaseService.schema.products.isActive,
      })
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.sellerId, seller.id));

    const publishedProductsCount = products.filter(
      (p) => p.moderationStatus === 'PUBLISHED' && p.isActive,
    ).length;
    const pendingReviewProductsCount = products.filter(
      (p) => p.moderationStatus === 'PENDING_REVIEW',
    ).length;

    // 5. Query inventory health across seller's product variants
    const productIds = products.map((p) => p.id);
    let lowStockVariantsCount = 0;
    let outOfStockVariantsCount = 0;

    if (productIds.length > 0) {
      const variants = await this.databaseService.db
        .select({
          id: this.databaseService.schema.productVariants.id,
        })
        .from(this.databaseService.schema.productVariants)
        .where(inArray(this.databaseService.schema.productVariants.productId, productIds));

      const variantIds = variants.map((v) => v.id);
      if (variantIds.length > 0) {
        const inventoryRows = await this.databaseService.db
          .select({
            quantityOnHand: this.databaseService.schema.inventoryItems.quantityOnHand,
            quantityReserved: this.databaseService.schema.inventoryItems.quantityReserved,
            lowStockThreshold: this.databaseService.schema.inventoryItems.lowStockThreshold,
            isUnlimited: this.databaseService.schema.inventoryItems.isUnlimited,
          })
          .from(this.databaseService.schema.inventoryItems)
          .where(inArray(this.databaseService.schema.inventoryItems.variantId, variantIds));

        for (const inv of inventoryRows) {
          if (!inv.isUnlimited) {
            const available = inv.quantityOnHand - inv.quantityReserved;
            if (available <= 0) {
              outOfStockVariantsCount++;
            } else if (available <= inv.lowStockThreshold) {
              lowStockVariantsCount++;
            }
          }
        }
      }
    }

    // 6. Query authoritative financial position from G09 ledger
    const [balance] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.sellerBalances)
      .where(eq(this.databaseService.schema.sellerBalances.sellerId, seller.id))
      .limit(1);

    const financialPosition = {
      pendingEscrowMinor: balance?.pendingEscrowMinor ?? 0,
      availablePayoutMinor: balance?.availablePayoutMinor ?? 0,
      heldDisputeMinor: balance?.heldDisputeMinor ?? 0,
      lifetimePayoutMinor: balance?.lifetimePayoutMinor ?? 0,
      currency: balance?.currency || 'INR',
    };

    // 7. Action items: Prioritized list of tasks requiring seller action
    const actionItems: SellerActionItemDto[] = [];

    if (seller.verificationStatus === 'DRAFT' || seller.verificationStatus === 'REJECTED') {
      actionItems.push({
        id: 'action-kyc-pending',
        type: 'VERIFICATION_PENDING',
        severity: 'HIGH',
        title: 'Complete Artisan Onboarding & Verification',
        description: 'Submit your craft documents and workshop address to publish handmade items.',
        actionLabel: 'Complete Verification',
        actionUrl: '/onboarding',
      });
    } else if (seller.verificationStatus === 'PENDING_REVIEW') {
      actionItems.push({
        id: 'action-kyc-review',
        type: 'VERIFICATION_PENDING',
        severity: 'INFO',
        title: 'Artisan Verification Under Review',
        description: 'Your shop credentials are under review by our compliance team.',
        actionLabel: 'View Application Status',
        actionUrl: '/onboarding',
      });
    }

    if (actionRequiredOrdersCount > 0) {
      actionItems.push({
        id: 'action-orders-confirmed',
        type: 'UNPROCESSED_ORDER',
        severity: 'HIGH',
        title: `${actionRequiredOrdersCount} New Order${actionRequiredOrdersCount > 1 ? 's' : ''} Awaiting Production`,
        description: 'Review purchased handcrafted items and acknowledge to begin crafting.',
        actionLabel: 'Review & Accept Orders',
        actionUrl: '/orders?status=CONFIRMED',
      });
    }

    if (outOfStockVariantsCount > 0 || lowStockVariantsCount > 0) {
      actionItems.push({
        id: 'action-stock-low',
        type: 'LOW_STOCK',
        severity: outOfStockVariantsCount > 0 ? 'HIGH' : 'MEDIUM',
        title: `${outOfStockVariantsCount + lowStockVariantsCount} Items Low or Out of Stock`,
        description: 'Update inventory to prevent customer checkout issues or overselling.',
        actionLabel: 'Adjust Inventory',
        actionUrl: '/inventory',
      });
    }

    if (pendingReviewProductsCount > 0) {
      actionItems.push({
        id: 'action-products-pending',
        type: 'REJECTED_PRODUCT',
        severity: 'INFO',
        title: `${pendingReviewProductsCount} Product Listing${pendingReviewProductsCount > 1 ? 's' : ''} Under Review`,
        description: 'Our catalog moderation team is verifying craft details and descriptions.',
        actionLabel: 'View Products',
        actionUrl: '/products',
      });
    }

    // 8. Recent activity: Real events sourced from database
    const recentSubOrders = await this.databaseService.db
      .select({
        id: this.databaseService.schema.subOrders.id,
        subOrderNumber: this.databaseService.schema.subOrders.subOrderNumber,
        status: this.databaseService.schema.subOrders.status,
        itemSubtotalMinor: this.databaseService.schema.subOrders.itemSubtotalMinor,
        createdAt: this.databaseService.schema.subOrders.createdAt,
      })
      .from(this.databaseService.schema.subOrders)
      .where(eq(this.databaseService.schema.subOrders.sellerId, seller.id))
      .orderBy(desc(this.databaseService.schema.subOrders.createdAt))
      .limit(6);

    const recentActivity: SellerRecentActivityDto[] = recentSubOrders.map((so) => ({
      id: so.id,
      type: 'ORDER_RECEIVED',
      title: `Order #${so.subOrderNumber}`,
      description: `₹${(so.itemSubtotalMinor / 100).toLocaleString('en-IN')} - Status: ${so.status}`,
      timestamp: so.createdAt.toISOString(),
      referenceId: so.id,
    }));

    return {
      metrics: {
        ordersCount,
        actionRequiredOrdersCount,
        grossSalesMinor,
        netPayableMinor,
        publishedProductsCount,
        pendingReviewProductsCount,
        lowStockVariantsCount,
        outOfStockVariantsCount,
      },
      financialPosition,
      actionItems,
      recentActivity,
      period,
      timeZone: 'Asia/Kolkata',
    };
  }

  /**
   * Produces seller sales and product performance analytics based on authoritative order data.
   */
  async getPerformanceAnalytics(
    userId: string,
    query: SellerAnalyticsQuery,
  ): Promise<SellerAnalyticsPerformanceDto> {
    const seller = await this.getSellerByUserId(userId);
    const period = query.period || '30d';

    const days = period === '90d' ? 90 : period === '7d' ? 7 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Fetch sub-orders in the timeframe
    const subOrders = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.subOrders)
      .where(
        and(
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
          gte(this.databaseService.schema.subOrders.createdAt, startDate),
        ),
      )
      .orderBy(this.databaseService.schema.subOrders.createdAt);

    const totalOrders = subOrders.length;
    const grossSalesMinor = subOrders.reduce(
      (acc, o) => acc + o.itemSubtotalMinor + o.shippingFeeMinor,
      0,
    );
    const netPayableMinor = subOrders.reduce((acc, o) => acc + o.netSellerPayableMinor, 0);
    const commissionPaidMinor = subOrders.reduce((acc, o) => acc + o.commissionFeeMinor, 0);
    const averageOrderValueMinor = totalOrders > 0 ? Math.round(grossSalesMinor / totalOrders) : 0;

    const cancelledCount = subOrders.filter((o) => o.status === 'CANCELLED').length;
    const completedOrdersCount = subOrders.filter(
      (o) => o.status === 'COMPLETED' || o.status === 'DELIVERED',
    ).length;
    const cancellationRateBps =
      totalOrders > 0 ? Math.round((cancelledCount / totalOrders) * 10000) : 0;

    // 2. Build daily sales trend points
    const dailyMap = new Map<
      string,
      { ordersCount: number; grossSalesMinor: number; netPayableMinor: number }
    >();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0]!;
      dailyMap.set(dateStr, { ordersCount: 0, grossSalesMinor: 0, netPayableMinor: 0 });
    }

    for (const o of subOrders) {
      const dateStr = o.createdAt.toISOString().split('T')[0]!;
      const existing = dailyMap.get(dateStr) || {
        ordersCount: 0,
        grossSalesMinor: 0,
        netPayableMinor: 0,
      };
      existing.ordersCount++;
      existing.grossSalesMinor += o.itemSubtotalMinor + o.shippingFeeMinor;
      existing.netPayableMinor += o.netSellerPayableMinor;
      dailyMap.set(dateStr, existing);
    }

    const salesTrend: SellerSalesTrendPointDto[] = Array.from(dailyMap.entries()).map(
      ([date, stats]) => ({
        date,
        ordersCount: stats.ordersCount,
        grossSalesMinor: stats.grossSalesMinor,
        netPayableMinor: stats.netPayableMinor,
      }),
    );

    // 3. Aggregate top products by units sold
    const topProducts: SellerTopProductDto[] = [];
    const subOrderIds = subOrders.map((o) => o.id);

    if (subOrderIds.length > 0) {
      const itemAggregates = await this.databaseService.db
        .select({
          variantId: this.databaseService.schema.orderItems.variantId,
          title: this.databaseService.schema.orderItems.titleSnapshot,
          sku: this.databaseService.schema.orderItems.skuSnapshot,
          unitsSold: sql<number>`sum(${this.databaseService.schema.orderItems.quantity})::int`,
          totalRevenueMinor: sql<number>`sum(${this.databaseService.schema.orderItems.totalPriceMinor})::int`,
        })
        .from(this.databaseService.schema.orderItems)
        .where(
          and(
            inArray(this.databaseService.schema.orderItems.subOrderId, subOrderIds),
            eq(this.databaseService.schema.orderItems.sellerId, seller.id),
          ),
        )
        .groupBy(
          this.databaseService.schema.orderItems.variantId,
          this.databaseService.schema.orderItems.titleSnapshot,
          this.databaseService.schema.orderItems.skuSnapshot,
        )
        .orderBy(desc(sql`sum(${this.databaseService.schema.orderItems.quantity})`))
        .limit(5);

      for (const item of itemAggregates) {
        topProducts.push({
          variantId: item.variantId,
          title: item.title,
          sku: item.sku,
          unitsSold: item.unitsSold,
          totalRevenueMinor: item.totalRevenueMinor,
        });
      }
    }

    return {
      period,
      summary: {
        totalOrders,
        grossSalesMinor,
        netPayableMinor,
        commissionPaidMinor,
        averageOrderValueMinor,
        cancellationRateBps,
        completedOrdersCount,
        currency: 'INR',
      },
      salesTrend,
      topProducts,
    };
  }

  /**
   * Updates permitted shop profile settings.
   */
  async updateShopProfile(userId: string, input: UpdateShopProfileInput): Promise<ShopProfileDto> {
    const seller = await this.getSellerByUserId(userId);

    const [shop] = await this.databaseService.db
      .select()
      .from(this.databaseService.schema.shops)
      .where(eq(this.databaseService.schema.shops.sellerId, seller.id))
      .limit(1);

    if (!shop) {
      throw new NotFoundException('Shop profile not found for authenticated seller');
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.shopName !== undefined) updatePayload['name'] = input.shopName;
    if (input.description !== undefined) updatePayload['description'] = input.description;
    if (input.craftStory !== undefined) updatePayload['craftStory'] = input.craftStory;
    if (input.logoUrl !== undefined) updatePayload['logoUrl'] = input.logoUrl;
    if (input.bannerUrl !== undefined) updatePayload['bannerUrl'] = input.bannerUrl;
    if (input.isVacationMode !== undefined) updatePayload['isVacationMode'] = input.isVacationMode;
    if (input.vacationMessage !== undefined)
      updatePayload['vacationMessage'] = input.vacationMessage;

    const [updatedShop] = await this.databaseService.db
      .update(this.databaseService.schema.shops)
      .set(updatePayload)
      .where(eq(this.databaseService.schema.shops.id, shop.id))
      .returning();

    if (!updatedShop) {
      throw new NotFoundException('Failed to update shop profile');
    }

    await this.auditService.logEvent({
      actorId: userId,
      actorRole: 'APPROVED_SELLER',
      action: 'SELLER_SHOP_PROFILE_UPDATED',
      resourceType: 'SHOP',
      resourceId: shop.id,
      metadata: {
        shopName: input.shopName,
        isVacationMode: input.isVacationMode,
      },
    });

    return {
      shopId: updatedShop.id,
      sellerId: seller.id,
      shopName: updatedShop.name,
      shopSlug: updatedShop.slug,
      status: seller.verificationStatus,
      description: updatedShop.description,
      craftStory: updatedShop.craftStory,
      logoUrl: updatedShop.logoUrl,
      bannerUrl: updatedShop.bannerUrl,
      ratingAverage: Number(updatedShop.ratingAverage || 0),
      ratingCount: updatedShop.ratingCount,
      isVacationMode: updatedShop.isVacationMode,
      vacationMessage: updatedShop.vacationMessage,
    };
  }

  /**
   * Aggregates relevant actionable notifications for the seller.
   */
  async getNotifications(userId: string): Promise<SellerNotificationDto[]> {
    const seller = await this.getSellerByUserId(userId);
    const notifications: SellerNotificationDto[] = [];

    // 1. Check verification status
    if (seller.verificationStatus !== 'VERIFIED') {
      notifications.push({
        id: 'notif-kyc',
        type: 'ACCOUNT',
        title: 'Account Verification Status',
        message: `Your seller status is currently ${seller.verificationStatus}. Review your application requirements.`,
        createdAt: new Date().toISOString(),
        isRead: false,
        actionUrl: '/onboarding',
      });
    }

    // 2. Check pending orders
    const pendingOrders = await this.databaseService.db
      .select({
        subOrderNumber: this.databaseService.schema.subOrders.subOrderNumber,
        createdAt: this.databaseService.schema.subOrders.createdAt,
      })
      .from(this.databaseService.schema.subOrders)
      .where(
        and(
          eq(this.databaseService.schema.subOrders.sellerId, seller.id),
          eq(this.databaseService.schema.subOrders.status, 'CONFIRMED'),
        ),
      )
      .limit(3);

    for (const po of pendingOrders) {
      notifications.push({
        id: `notif-order-${po.subOrderNumber}`,
        type: 'ORDER',
        title: 'New Order Received',
        message: `Order #${po.subOrderNumber} is confirmed and waiting for production.`,
        createdAt: po.createdAt.toISOString(),
        isRead: false,
        actionUrl: `/orders?status=CONFIRMED`,
      });
    }

    // 3. Check low inventory alerts
    const products = await this.databaseService.db
      .select({
        id: this.databaseService.schema.products.id,
        title: this.databaseService.schema.products.title,
      })
      .from(this.databaseService.schema.products)
      .where(eq(this.databaseService.schema.products.sellerId, seller.id));

    const productIds = products.map((p) => p.id);
    if (productIds.length > 0) {
      const variants = await this.databaseService.db
        .select({
          id: this.databaseService.schema.productVariants.id,
          sku: this.databaseService.schema.productVariants.sku,
        })
        .from(this.databaseService.schema.productVariants)
        .where(inArray(this.databaseService.schema.productVariants.productId, productIds));

      const variantIds = variants.map((v) => v.id);
      if (variantIds.length > 0) {
        const inventories = await this.databaseService.db
          .select({
            variantId: this.databaseService.schema.inventoryItems.variantId,
            quantityOnHand: this.databaseService.schema.inventoryItems.quantityOnHand,
            quantityReserved: this.databaseService.schema.inventoryItems.quantityReserved,
            lowStockThreshold: this.databaseService.schema.inventoryItems.lowStockThreshold,
            isUnlimited: this.databaseService.schema.inventoryItems.isUnlimited,
          })
          .from(this.databaseService.schema.inventoryItems)
          .where(inArray(this.databaseService.schema.inventoryItems.variantId, variantIds))
          .limit(10);

        const skuMap = new Map(variants.map((v) => [v.id, v.sku]));

        for (const inv of inventories) {
          if (!inv.isUnlimited) {
            const available = inv.quantityOnHand - inv.quantityReserved;
            if (available <= inv.lowStockThreshold) {
              const sku = skuMap.get(inv.variantId) || 'VARIANT';
              notifications.push({
                id: `notif-stock-${inv.variantId}`,
                type: 'STOCK',
                title: available <= 0 ? 'Out of Stock Alert' : 'Low Stock Warning',
                message: `SKU ${sku} has ${Math.max(0, available)} unit(s) available.`,
                createdAt: new Date().toISOString(),
                isRead: false,
                actionUrl: '/inventory',
              });
            }
          }
        }
      }
    }

    return notifications;
  }
}
