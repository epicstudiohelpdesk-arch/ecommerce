import { describe, it, expect } from 'vitest';
import { CommissionService } from '../src/modules/payments/commission.service';

describe('CommissionService - Marketplace Take & Seller Entitlement', () => {
  const service = new CommissionService();

  it('calculates standard 10% (1000 bps) marketplace commission accurately', () => {
    // ₹1,500 item + ₹150 shipping
    const res = service.calculateSubOrderFinancials({
      itemSubtotalMinor: 150000,
      shippingFeeMinor: 15000,
      taxMinor: 0,
      commissionRateBps: 1000,
    });

    // 10% of 150000 = 15000 paise (₹150)
    expect(res.commissionFeeMinor).toBe(15000);
    // Net seller payable = 150000 + 15000 - 15000 = 150000 paise (₹1,500)
    expect(res.netSellerPayableMinor).toBe(150000);
    expect(res.taxMinor).toBe(0);

    // Exact conservation
    expect(res.netSellerPayableMinor + res.commissionFeeMinor + res.taxMinor).toBe(
      res.itemSubtotalMinor + res.shippingFeeMinor,
    );
  });

  it('calculates custom artisan commission rate with statutory tax deductions', () => {
    // 15% (1500 bps) commission on ₹2,499.50 pottery creation + ₹200 shipping + ₹50 TCS tax
    const res = service.calculateSubOrderFinancials({
      itemSubtotalMinor: 249950,
      shippingFeeMinor: 20000,
      taxMinor: 5000,
      commissionRateBps: 1500,
    });

    // 15% of 249950 = 37492.5 -> rounds to 37493 paise
    expect(res.commissionFeeMinor).toBe(37493);
    // Net payable = 249950 + 20000 - 37493 - 5000 = 227457 paise
    expect(res.netSellerPayableMinor).toBe(227457);

    // Exact conservation
    expect(res.netSellerPayableMinor + res.commissionFeeMinor + res.taxMinor).toBe(
      res.itemSubtotalMinor + res.shippingFeeMinor,
    );
  });

  it('enforces non-negative input bounds and valid basis point range', () => {
    expect(() =>
      service.calculateSubOrderFinancials({
        itemSubtotalMinor: -500,
        shippingFeeMinor: 1000,
      }),
    ).toThrow(RangeError);

    expect(() =>
      service.calculateSubOrderFinancials({
        itemSubtotalMinor: 1000,
        shippingFeeMinor: 100,
        commissionRateBps: 12000, // > 10000 bps
      }),
    ).toThrow(RangeError);
  });

  it('calculates pro-rata refund distribution correctly', () => {
    // Sub-order: Item 100000 (₹1,000), Shipping 0, Commission 10000 (₹100), Net 90000 (₹900)
    // Customer returns half (₹500 = 50000 paise)
    const split = service.calculateRefundSplit(50000, {
      itemSubtotalMinor: 100000,
      shippingFeeMinor: 0,
      commissionFeeMinor: 10000,
      netSellerPayableMinor: 90000,
    });

    // 10% commission of 50000 = 5000 paise platform take reversed
    expect(split.platformCommissionRefundMinor).toBe(5000);
    // 90% seller share of 50000 = 45000 paise seller deduction
    expect(split.sellerDeductionMinor).toBe(45000);
    expect(split.platformCommissionRefundMinor + split.sellerDeductionMinor).toBe(50000);
  });

  it('rejects refund amount exceeding gross sub-order value', () => {
    expect(() =>
      service.calculateRefundSplit(150000, {
        itemSubtotalMinor: 100000,
        shippingFeeMinor: 0,
        commissionFeeMinor: 10000,
        netSellerPayableMinor: 90000,
      }),
    ).toThrow(RangeError);
  });
});
