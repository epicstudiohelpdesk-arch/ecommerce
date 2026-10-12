'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';
import { getApiBaseUrl, formatMinorPrice } from '../../lib/api';
import type { PricingBreakdownDto } from '@repo/api-contracts';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, itemsCount, sessionId, refreshCart } = useCart();

  // Address State
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Quote / Pricing Breakdown State
  const [pricing, setPricing] = useState<PricingBreakdownDto | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch initial quote when cart loads
  useEffect(() => {
    if (cart && cart.itemsCount > 0) {
      fetchQuote();
    }
  }, [cart?.itemsCount]);

  const fetchQuote = async (couponToApply?: string) => {
    if (!sessionId) return;
    try {
      setIsQuoting(true);
      setCouponError(null);
      const res = await fetch(`${getApiBaseUrl()}/checkout/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cart-session-id': sessionId,
        },
        credentials: 'include',
        body: JSON.stringify({
          couponCode: couponToApply ?? appliedCoupon ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (couponToApply) {
          setCouponError(data.error?.message || data.message || 'Invalid coupon code');
        }
        return;
      }

      setPricing(data.data.pricing);
      if (couponToApply) {
        setAppliedCoupon(couponToApply.toUpperCase());
      }
    } catch (err) {
      console.warn('[Checkout] Quote error:', err);
    } finally {
      setIsQuoting(false);
    }
  };

  const validateAddress = () => {
    const errs: Record<string, string> = {};
    if (!recipientName.trim() || recipientName.trim().length < 2) {
      errs['recipientName'] = 'Recipient full name is required (min 2 characters)';
    }
    const phoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;
    if (!phone.trim() || !phoneRegex.test(phone.trim())) {
      errs['phone'] = 'Valid 10-digit Indian phone number starting with 6-9 is required';
    }
    if (!addressLine1.trim() || addressLine1.trim().length < 5) {
      errs['addressLine1'] = 'Street address line 1 is required (min 5 characters)';
    }
    if (!city.trim() || city.trim().length < 2) {
      errs['city'] = 'City is required';
    }
    if (!state.trim() || state.trim().length < 2) {
      errs['state'] = 'State is required';
    }
    const pinRegex = /^[1-9][0-9]{5}$/;
    if (!postalCode.trim() || !pinRegex.test(postalCode.trim())) {
      errs['postalCode'] = 'Valid 6-digit Indian PIN code is required (e.g. 560001)';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAddress()) {
      return;
    }

    if (!cart || cart.itemsCount === 0) {
      setErrorMessage('Your cart is empty. Please add items before checking out.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const addressInput = {
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || null,
        locality: locality.trim() || null,
        city: city.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        country: 'IN',
        deliveryInstructions: deliveryInstructions.trim() || null,
        isDefault: true,
      };

      // 1. Create checkout session and atomically lock inventory for 15 minutes
      const sessionRes = await fetch(`${getApiBaseUrl()}/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cart-session-id': sessionId,
        },
        credentials: 'include',
        body: JSON.stringify({
          addressInput,
          couponCode: appliedCoupon ?? undefined,
        }),
      });

      const sessionData = await sessionRes.json();
      if (!sessionRes.ok || !sessionData.success) {
        throw new Error(
          sessionData.error?.message ||
            sessionData.message ||
            'Failed to initialize checkout session',
        );
      }

      const checkoutSessionId = sessionData.data.checkoutId;
      const idempotencyKey = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 2. Confirm order creation
      const confirmRes = await fetch(`${getApiBaseUrl()}/checkout/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cart-session-id': sessionId,
          'idempotency-key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify({
          checkoutSessionId,
          customerNote: deliveryInstructions.trim() || undefined,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.success) {
        throw new Error(
          confirmData.error?.message || confirmData.message || 'Failed to confirm order placement',
        );
      }

      // 3. Clear cart client state and navigate to success page
      await refreshCart();
      router.push(`/checkout/success?orderNumber=${confirmData.data.orderNumber}`);
    } catch (err) {
      setErrorMessage((err as Error).message || 'An unexpected error occurred during checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!cart || itemsCount === 0) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-stone-900">Your cart is empty</h1>
        <p className="text-stone-600 text-sm">
          Please add items to your cart before proceeding to checkout.
        </p>
        <Link
          href="/cart"
          className="inline-block px-6 py-2.5 bg-amber-600 text-white font-semibold rounded-xl text-sm"
        >
          Return to Cart
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
          Checkout &amp; Order Placement
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Review your handcrafted items, provide delivery details, and reserve workshop inventory.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-3">
          <span className="text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <p className="font-bold">Checkout Could Not Proceed</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Gate G08 Architecture Notice */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
        <span className="text-lg leading-none mt-0.5">✦</span>
        <div className="space-y-1">
          <p className="font-bold">Gate G08 Foundation Mode</p>
          <p className="text-amber-800 leading-relaxed">
            Placing your order will generate partitioned artisan sub-orders and hold live studio
            inventory with a 15-minute transactional lock. Orders remain in <strong>PENDING</strong>{' '}
            payment status. Online payment gateway integration will be introduced in Gate G09.
          </p>
        </div>
      </div>

      <form
        onSubmit={handlePlaceOrder}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left Column: Delivery Address & Artisan Sub-orders */}
        <div className="lg:col-span-8 space-y-8">
          {/* Section 1: Delivery Address Form */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold">
                1
              </span>
              <span>Delivery Address in India</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Recipient Full Name *
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Ananya Sharma"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors['recipientName'] ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                  }`}
                />
                {errors['recipientName'] && (
                  <p className="text-rose-600 text-[11px] mt-1">{errors['recipientName']}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  10-Digit Mobile Number *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors['phone'] ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                  }`}
                />
                {errors['phone'] && (
                  <p className="text-rose-600 text-[11px] mt-1">{errors['phone']}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-stone-700 mb-1">
                  Street Address Line 1 *
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="e.g. Flat 402, Lotus Apartments, 14th Main"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors['addressLine1'] ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                  }`}
                />
                {errors['addressLine1'] && (
                  <p className="text-rose-600 text-[11px] mt-1">{errors['addressLine1']}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="e.g. Near Community Park"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Locality / Area (Optional)
                </label>
                <input
                  type="text"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Indiranagar"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">City *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Bengaluru"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors['city'] ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                  }`}
                />
                {errors['city'] && (
                  <p className="text-rose-600 text-[11px] mt-1">{errors['city']}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">State / UT *</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Karnataka"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors['state'] ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                  }`}
                />
                {errors['state'] && (
                  <p className="text-rose-600 text-[11px] mt-1">{errors['state']}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  6-Digit Indian PIN Code *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="e.g. 560038"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    errors['postalCode'] ? 'border-rose-400 bg-rose-50/30' : 'border-stone-300'
                  }`}
                />
                {errors['postalCode'] && (
                  <p className="text-rose-600 text-[11px] mt-1">{errors['postalCode']}</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Country</label>
                <input
                  type="text"
                  disabled
                  value="India (IN)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-100 text-stone-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-stone-700 mb-1">
                  Delivery Instructions / Notes for Courier (Optional)
                </label>
                <textarea
                  rows={2}
                  value={deliveryInstructions}
                  onChange={(e) => setDeliveryInstructions(e.target.value)}
                  placeholder="e.g. Please leave with security guard if not available, fragile package"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Artisan Studio Fulfillment Review */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              <span>
                Artisan Studio Shipments ({cart.sellerGroups.length} independent shipments)
              </span>
            </h2>

            <div className="space-y-4">
              {cart.sellerGroups.map((group) => (
                <div
                  key={group.sellerId}
                  className="border border-stone-200 rounded-xl p-4 bg-stone-50/50 space-y-3"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-900">Studio: {group.shopName}</span>
                    <span className="text-stone-500 font-medium">
                      Shipping:{' '}
                      {group.shippingFeeMinor === 0
                        ? 'FREE'
                        : formatMinorPrice(group.shippingFeeMinor)}
                    </span>
                  </div>

                  <div className="divide-y divide-stone-200/60 text-xs">
                    {group.items.map((item) => (
                      <div key={item.id} className="py-2 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-stone-800">{item.productTitle}</p>
                          <p className="text-stone-500">
                            Qty: {item.quantity} &bull; {item.variantTitle}
                          </p>
                        </div>
                        <span className="font-semibold text-stone-900">
                          {formatMinorPrice(item.lineTotalMinor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Order Pricing Summary & Place Order Button */}
        <div className="lg:col-span-4 space-y-6">
          {/* Coupon Entry Box */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Promo or Artisan Coupon Code
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="ENTER COUPON"
                className="flex-1 px-3 py-2 text-xs border border-stone-300 rounded-xl uppercase font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                disabled={isQuoting || !couponCode.trim()}
                onClick={() => fetchQuote(couponCode.trim())}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {isQuoting ? '...' : 'Apply'}
              </button>
            </div>
            {couponError && <p className="text-[11px] text-rose-600 font-medium">{couponError}</p>}
            {appliedCoupon && (
              <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <span>✓</span> Coupon &ldquo;{appliedCoupon}&rdquo; applied successfully!
              </p>
            )}
          </div>

          {/* Pricing Breakdown Card */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm space-y-6">
            <h2 className="text-base font-bold text-stone-900 border-b border-stone-200 pb-3">
              Payment Summary
            </h2>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between text-stone-600">
                <span>Items Subtotal</span>
                <span className="font-semibold text-stone-900">
                  {formatMinorPrice(pricing ? pricing.subtotalMinor : cart.subtotalMinor)}
                </span>
              </div>

              <div className="flex justify-between text-stone-600">
                <span>Artisan Studio Shipping</span>
                <span className="font-semibold text-stone-900">
                  {formatMinorPrice(
                    pricing ? pricing.shippingTotalMinor : cart.estimatedShippingMinor,
                  )}
                </span>
              </div>

              {pricing && pricing.discountTotalMinor > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Coupon Discount</span>
                  <span className="font-semibold">
                    -{formatMinorPrice(pricing.discountTotalMinor)}
                  </span>
                </div>
              )}

              <div className="border-t border-stone-200 pt-3 flex justify-between text-base font-extrabold text-stone-900">
                <span>Total Amount</span>
                <span>
                  {formatMinorPrice(pricing ? pricing.grandTotalMinor : cart.totalEstimatedMinor)}
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Calculated authoritatively in INR minor paise.
              </p>
            </div>

            {/* Place Order CTA Button */}
            <button
              type="submit"
              disabled={isSubmitting || cart.hasUnavailableItems}
              className={`w-full py-4 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                isSubmitting || cart.hasUnavailableItems
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer active:bg-amber-700'
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Locking Stock &amp; Confirming Order...
                </span>
              ) : (
                <span>
                  Place Order &bull;{' '}
                  {formatMinorPrice(pricing ? pricing.grandTotalMinor : cart.totalEstimatedMinor)}
                </span>
              )}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/cart"
                className="text-xs text-stone-500 hover:text-stone-800 underline font-medium"
              >
                &larr; Return to Shopping Cart
              </Link>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
