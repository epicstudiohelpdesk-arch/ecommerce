import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import type { coupons } from '@repo/db';
import type { CartDto, PricingBreakdownDto, PricingBreakdownSellerDto } from '@repo/api-contracts';

type DbTransaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];

@Injectable()
export class PricingService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Authoritatively computes exact integer pricing breakdown (in paise) for a cart and optional coupon.
   */
  async calculateCartPricing(cart: CartDto, couponCode?: string): Promise<PricingBreakdownDto> {
    if (!cart.sellerGroups || cart.sellerGroups.length === 0) {
      return {
        currency: 'INR',
        subtotalMinor: 0,
        shippingTotalMinor: 0,
        discountTotalMinor: 0,
        taxTotalMinor: 0,
        grandTotalMinor: 0,
        couponCode: null,
        sellers: [],
      };
    }

    const overallSubtotal = cart.subtotalMinor;
    let couponDiscountTotal = 0;
    let appliedCoupon: typeof coupons.$inferSelect | null = null;

    if (couponCode && couponCode.trim()) {
      const codeUpper = couponCode.trim().toUpperCase();
      const now = new Date();

      const [coupon] = await this.databaseService.db
        .select()
        .from(this.databaseService.schema.coupons)
        .where(
          and(
            eq(this.databaseService.schema.coupons.code, codeUpper),
            eq(this.databaseService.schema.coupons.isActive, true),
          ),
        )
        .limit(1);

      if (!coupon) {
        throw new BadRequestException(`Coupon code "${codeUpper}" is invalid or inactive`);
      }

      if (coupon.startsAt > now || coupon.expiresAt < now) {
        throw new BadRequestException(`Coupon code "${codeUpper}" has expired`);
      }

      if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
        throw new BadRequestException(
          `Coupon code "${codeUpper}" has reached its maximum usage limit`,
        );
      }

      if (overallSubtotal < coupon.minOrderMinor) {
        throw new BadRequestException(
          `Coupon code "${codeUpper}" requires a minimum order of ₹${(coupon.minOrderMinor / 100).toFixed(2)}`,
        );
      }

      appliedCoupon = coupon;

      if (coupon.discountType === 'PERCENTAGE') {
        // discountValue is in basis points (100 bps = 1%)
        const calculatedDiscount = Math.floor((overallSubtotal * coupon.discountValue) / 10000);
        couponDiscountTotal = coupon.maxDiscountMinor
          ? Math.min(calculatedDiscount, coupon.maxDiscountMinor)
          : calculatedDiscount;
      } else {
        // FIXED_AMOUNT (in minor units)
        couponDiscountTotal = Math.min(overallSubtotal, coupon.discountValue);
      }
    }

    // Process seller groups
    const sellers: PricingBreakdownSellerDto[] = [];
    let remainingDiscountToDistribute = couponDiscountTotal;

    for (let i = 0; i < cart.sellerGroups.length; i++) {
      const group = cart.sellerGroups[i]!;
      const isLast = i === cart.sellerGroups.length - 1;

      // Query seller profile to get commissionRateBps
      const [profile] = await this.databaseService.db
        .select({
          commissionRateBps: this.databaseService.schema.sellerProfiles.commissionRateBps,
        })
        .from(this.databaseService.schema.sellerProfiles)
        .where(eq(this.databaseService.schema.sellerProfiles.id, group.sellerId))
        .limit(1);

      const commissionRateBps = profile?.commissionRateBps ?? 1000; // default 10%

      let sellerDiscountMinor = 0;

      if (appliedCoupon) {
        if (appliedCoupon.sellerId) {
          // Seller-specific coupon
          if (appliedCoupon.sellerId === group.sellerId) {
            sellerDiscountMinor = Math.min(group.subtotalMinor, couponDiscountTotal);
          }
        } else {
          // Platform-wide coupon: distribute proportionally across seller groups
          if (isLast) {
            sellerDiscountMinor = remainingDiscountToDistribute;
          } else {
            sellerDiscountMinor = Math.floor(
              (group.subtotalMinor / overallSubtotal) * couponDiscountTotal,
            );
            remainingDiscountToDistribute -= sellerDiscountMinor;
          }
        }
      }

      const itemSubtotalMinor = group.subtotalMinor;
      const shippingFeeMinor = group.shippingFeeMinor;
      const taxMinor = 0; // Handcrafted goods pricing inclusive in baseline
      const sellerTotalMinor =
        itemSubtotalMinor + shippingFeeMinor - sellerDiscountMinor + taxMinor;

      // Commission is charged on item subtotal (excluding shipping)
      const commissionFeeMinor = Math.floor((itemSubtotalMinor * commissionRateBps) / 10000);
      const netSellerPayableMinor = Math.max(
        0,
        itemSubtotalMinor + shippingFeeMinor - commissionFeeMinor - sellerDiscountMinor,
      );

      sellers.push({
        sellerId: group.sellerId,
        shopName: group.shopName,
        itemSubtotalMinor,
        shippingFeeMinor,
        sellerDiscountMinor,
        taxMinor,
        sellerTotalMinor,
        commissionFeeMinor,
        netSellerPayableMinor,
      });
    }

    const subtotalMinor = sellers.reduce((sum, s) => sum + s.itemSubtotalMinor, 0);
    const shippingTotalMinor = sellers.reduce((sum, s) => sum + s.shippingFeeMinor, 0);
    const discountTotalMinor = sellers.reduce((sum, s) => sum + s.sellerDiscountMinor, 0);
    const taxTotalMinor = sellers.reduce((sum, s) => sum + s.taxMinor, 0);
    const grandTotalMinor = Math.max(
      0,
      subtotalMinor + shippingTotalMinor + taxTotalMinor - discountTotalMinor,
    );

    return {
      currency: 'INR',
      subtotalMinor,
      shippingTotalMinor,
      discountTotalMinor,
      taxTotalMinor,
      grandTotalMinor,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      sellers,
    };
  }

  /**
   * Persists or updates an immutable pricing snapshot for a checkout attempt.
   */
  async recordPricingSnapshot(
    checkoutId: string,
    pricing: PricingBreakdownDto,
    tx?: DbTransaction,
  ): Promise<string> {
    const run = async (t: DbTransaction) => {
      const [existing] = await t
        .select()
        .from(this.databaseService.schema.pricingSnapshots)
        .where(eq(this.databaseService.schema.pricingSnapshots.checkoutId, checkoutId))
        .limit(1);

      if (existing) {
        await t
          .update(this.databaseService.schema.pricingSnapshots)
          .set({
            subtotalMinor: pricing.subtotalMinor,
            shippingTotalMinor: pricing.shippingTotalMinor,
            discountTotalMinor: pricing.discountTotalMinor,
            taxTotalMinor: pricing.taxTotalMinor,
            grandTotalMinor: pricing.grandTotalMinor,
            breakdownJson: pricing,
          })
          .where(eq(this.databaseService.schema.pricingSnapshots.id, existing.id));
        return existing.id;
      }

      const [record] = await t
        .insert(this.databaseService.schema.pricingSnapshots)
        .values({
          checkoutId,
          subtotalMinor: pricing.subtotalMinor,
          shippingTotalMinor: pricing.shippingTotalMinor,
          discountTotalMinor: pricing.discountTotalMinor,
          taxTotalMinor: pricing.taxTotalMinor,
          grandTotalMinor: pricing.grandTotalMinor,
          breakdownJson: pricing,
        })
        .returning();

      if (!record) {
        throw new BadRequestException('Failed to persist pricing snapshot');
      }

      return record.id;
    };

    if (tx) {
      return run(tx);
    }
    return this.databaseService.db.transaction(run);
  }
}
