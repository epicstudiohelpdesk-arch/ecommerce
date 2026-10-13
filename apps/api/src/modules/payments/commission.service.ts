import { Injectable } from '@nestjs/common';

export interface SubOrderFinancialBreakdown {
  itemSubtotalMinor: number;
  shippingFeeMinor: number;
  taxMinor: number;
  commissionRateBps: number;
  commissionFeeMinor: number;
  netSellerPayableMinor: number;
}

export interface RefundSplit {
  sellerDeductionMinor: number;
  platformCommissionRefundMinor: number;
}

@Injectable()
export class CommissionService {
  /**
   * Default platform commission in basis points (1000 bps = 10.00%).
   */
  readonly DEFAULT_COMMISSION_BPS = 1000;

  /**
   * Authoritatively calculates commission fee and net seller payable for a sub-order.
   *
   * Invariant:
   * commissionFeeMinor = round(itemSubtotalMinor * commissionRateBps / 10000)
   * netSellerPayableMinor = itemSubtotalMinor + shippingFeeMinor - commissionFeeMinor - taxMinor
   *
   * Guarantees exact conservation: netSellerPayable + commissionFee + tax === itemSubtotal + shippingFee
   */
  calculateSubOrderFinancials(params: {
    itemSubtotalMinor: number;
    shippingFeeMinor: number;
    taxMinor?: number;
    commissionRateBps?: number;
  }): SubOrderFinancialBreakdown {
    const { itemSubtotalMinor, shippingFeeMinor } = params;
    const taxMinor = params.taxMinor ?? 0;
    const commissionRateBps = params.commissionRateBps ?? this.DEFAULT_COMMISSION_BPS;

    if (itemSubtotalMinor < 0 || shippingFeeMinor < 0 || taxMinor < 0) {
      throw new RangeError('Financial amounts cannot be negative');
    }
    if (commissionRateBps < 0 || commissionRateBps > 10000) {
      throw new RangeError('Commission rate basis points must be between 0 and 10000 (0% - 100%)');
    }

    // Commission is applied to item subtotal (artisan creations)
    const commissionFeeMinor = Math.round((itemSubtotalMinor * commissionRateBps) / 10000);

    // Artisan receives (itemSubtotal + shipping - platform commission - tax)
    const netSellerPayableMinor =
      itemSubtotalMinor + shippingFeeMinor - commissionFeeMinor - taxMinor;

    if (netSellerPayableMinor < 0) {
      throw new RangeError(
        `Calculated net seller payable (${netSellerPayableMinor}) is negative. Fees and taxes exceed gross amount.`,
      );
    }

    // Conservation check
    const grossTotal = itemSubtotalMinor + shippingFeeMinor;
    const distributedTotal = netSellerPayableMinor + commissionFeeMinor + taxMinor;
    if (grossTotal !== distributedTotal) {
      throw new Error(
        `Financial Conservation Invariant Violation: Gross (${grossTotal}) !== Distributed (${distributedTotal})`,
      );
    }

    return {
      itemSubtotalMinor,
      shippingFeeMinor,
      taxMinor,
      commissionRateBps,
      commissionFeeMinor,
      netSellerPayableMinor,
    };
  }

  /**
   * Pro-rata calculates the refund split between platform commission clawback and seller escrow deduction.
   */
  calculateRefundSplit(
    refundAmountMinor: number,
    subOrder: {
      itemSubtotalMinor: number;
      shippingFeeMinor: number;
      commissionFeeMinor: number;
      netSellerPayableMinor: number;
    },
  ): RefundSplit {
    const grossTotal = subOrder.itemSubtotalMinor + subOrder.shippingFeeMinor;
    if (grossTotal <= 0) {
      return { sellerDeductionMinor: 0, platformCommissionRefundMinor: 0 };
    }

    if (refundAmountMinor > grossTotal) {
      throw new RangeError(
        `Refund amount (${refundAmountMinor}) exceeds gross sub-order (${grossTotal})`,
      );
    }

    // Calculate pro-rata commission refund portion
    const commissionShareRatio = subOrder.commissionFeeMinor / grossTotal;
    const platformCommissionRefundMinor = Math.round(refundAmountMinor * commissionShareRatio);
    const sellerDeductionMinor = refundAmountMinor - platformCommissionRefundMinor;

    return {
      sellerDeductionMinor,
      platformCommissionRefundMinor,
    };
  }
}
