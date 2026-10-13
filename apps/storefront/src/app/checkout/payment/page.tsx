'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchOrderDetails,
  initiatePayment,
  verifyPayment,
  formatMinorPrice,
} from '../../../lib/api';
import type { CheckoutOrderConfirmationDto } from '@repo/api-contracts';

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('orderNumber');

  const [order, setOrder] = useState<CheckoutOrderConfirmationDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Payment method selection
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [paymentProvider, setPaymentProvider] = useState<'RAZORPAY' | 'STRIPE'>('RAZORPAY');

  // Transaction execution states
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<
    'idle' | 'initiating' | 'gateway_modal' | 'verifying' | 'failed' | 'success'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeIntentId, setActiveIntentId] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) {
      setLoadError('No order number specified. Please return to your cart.');
      setIsLoading(false);
      return;
    }

    fetchOrderDetails(orderNumber)
      .then((res) => {
        if (res.success && res.data) {
          setOrder(res.data);
          // If already paid, redirect to success
          if (res.data.paymentStatus === 'PAID') {
            router.push(`/checkout/success?orderNumber=${orderNumber}`);
          }
        } else {
          setLoadError(res.error?.message || res.message || 'Order details could not be retrieved');
        }
      })
      .catch((err) => {
        setLoadError(err.message || 'Network error fetching order details');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [orderNumber]);

  const handleStartPayment = async () => {
    if (!order) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setPaymentStep('initiating');

      // 1. Call server to initiate authoritative payment attempt
      const initiateRes = await initiatePayment(order.orderNumber, paymentProvider);
      if (!initiateRes.success || !initiateRes.data) {
        throw new Error(
          initiateRes.error?.message || initiateRes.message || 'Payment initiation failed',
        );
      }

      const intent = initiateRes.data;
      setActiveIntentId(intent.providerOrderId);
      setPaymentStep('gateway_modal');
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Failed to initiate payment gateway attempt');
      setPaymentStep('failed');
      setIsProcessing(false);
    }
  };

  const handleSimulateGatewaySuccess = async () => {
    if (!order || !activeIntentId) return;

    try {
      setPaymentStep('verifying');
      setIsProcessing(true);

      const mockPaymentId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
      // In sandbox mode with mock/dev key, backend verifies signature or test fallback
      const verifyRes = await verifyPayment({
        orderNumber: order.orderNumber,
        providerOrderId: activeIntentId,
        providerPaymentId: mockPaymentId,
        providerSignature: `sig_sandbox_valid_${activeIntentId}_${mockPaymentId}`,
      });

      if (!verifyRes.success) {
        throw new Error(verifyRes.error?.message || verifyRes.message || 'Verification failed');
      }

      setPaymentStep('success');
      // Redirect to confirmation success page
      router.push(`/checkout/success?orderNumber=${order.orderNumber}`);
    } catch (err: unknown) {
      setErrorMessage((err as Error).message || 'Payment verification failed');
      setPaymentStep('failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateGatewayFailure = () => {
    setErrorMessage(
      'Customer bank declined transaction: Insufficient funds or authentication timeout (SIMULATED_FAILURE)',
    );
    setPaymentStep('failed');
    setIsProcessing(false);
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setPaymentStep('idle');
    setIsProcessing(false);
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-stone-600 text-sm">Securing payment connection and order details...</p>
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center text-2xl mx-auto">
          ⚠️
        </div>
        <h1 className="text-xl font-bold text-stone-900">Order Information Unavailable</h1>
        <p className="text-stone-600 text-sm">
          {loadError || 'The requested order could not be found.'}
        </p>
        <Link
          href="/cart"
          className="inline-block px-6 py-2.5 bg-amber-600 text-white font-semibold rounded-xl text-xs hover:bg-amber-500"
        >
          Return to Cart
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-8">
      {/* Stepper Header */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-center gap-2 text-xs text-stone-400 mb-2 font-medium">
          <span>1. Cart</span>
          <span>&rarr;</span>
          <span>2. Delivery</span>
          <span>&rarr;</span>
          <span className="text-amber-700 font-bold">3. Payment Authorization</span>
          <span>&rarr;</span>
          <span>4. Confirmation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
          Complete Your Handcrafted Purchase
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1">
          Review artisan workshop allocations and authorize your secure payment via Razorpay.
        </p>
      </div>

      {/* Error Alert on Failure */}
      {paymentStep === 'failed' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-rose-800">
            <span>⚠️</span>
            <span>Payment Authorization Unsuccessful</span>
          </div>
          <p className="leading-relaxed">
            {errorMessage || 'Your payment attempt could not be completed.'}
          </p>
          <div className="pt-2">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-xl text-xs shadow-sm transition-colors"
            >
              Try Again with Different Method &rarr;
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Payment Options & Method Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* Payment Method Cards */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800 pb-2 border-b border-stone-100">
              Select Payment Method
            </h2>

            <div className="space-y-3">
              {/* UPI Option */}
              <label
                className={`flex items-start p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === 'upi'
                    ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="upi"
                  checked={selectedMethod === 'upi'}
                  onChange={() => setSelectedMethod('upi')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-stone-900">UPI Instant Payment</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      Fastest
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Google Pay, PhonePe, Paytm, BHIM, or any UPI ID with zero surcharge.
                  </p>
                </div>
              </label>

              {/* Cards Option */}
              <label
                className={`flex items-start p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === 'card'
                    ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="card"
                  checked={selectedMethod === 'card'}
                  onChange={() => setSelectedMethod('card')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-stone-900">Credit / Debit Card</span>
                    <span className="text-xs text-stone-400">Visa, Mastercard, RuPay</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Secure 3D-Secure 2.0 authorization with bank OTP.
                  </p>
                </div>
              </label>

              {/* NetBanking Option */}
              <label
                className={`flex items-start p-4 rounded-2xl border cursor-pointer transition-all ${
                  selectedMethod === 'netbanking'
                    ? 'border-amber-600 bg-amber-50/40 ring-2 ring-amber-500/20'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="netbanking"
                  checked={selectedMethod === 'netbanking'}
                  onChange={() => setSelectedMethod('netbanking')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div className="ml-3 flex-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-stone-900">Net Banking</span>
                    <span className="text-xs text-stone-400">50+ Major Indian Banks</span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Direct bank debit via HDFC, ICICI, SBI, Axis, and more.
                  </p>
                </div>
              </label>
            </div>

            {/* Provider Switch (Razorpay default, Stripe secondary) */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
              <span>Payment Gateway:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentProvider('RAZORPAY')}
                  className={`px-2.5 py-1 rounded-lg font-semibold ${
                    paymentProvider === 'RAZORPAY'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  Razorpay (INR)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentProvider('STRIPE')}
                  className={`px-2.5 py-1 rounded-lg font-semibold ${
                    paymentProvider === 'STRIPE'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  Stripe
                </button>
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          {paymentStep === 'idle' && (
            <button
              onClick={handleStartPayment}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>
                🔒 Pay {formatMinorPrice(order.totalAmountMinor, order.currency)} Securely
              </span>
            </button>
          )}

          {paymentStep === 'initiating' && (
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-stone-700">
                Contacting {paymentProvider} to initiate encrypted checkout session...
              </p>
            </div>
          )}

          {/* Interactive Gateway Simulator Modal / Interface for sandbox */}
          {paymentStep === 'gateway_modal' && (
            <div className="p-6 bg-amber-50/70 border-2 border-amber-300 rounded-3xl space-y-4 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-amber-950">
                    {paymentProvider} Checkout Modal
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-stone-700">
                  {formatMinorPrice(order.totalAmountMinor, order.currency)}
                </span>
              </div>

              <p className="text-xs text-amber-900 leading-relaxed">
                Order <span className="font-mono font-bold">{order.orderNumber}</span> intent{' '}
                <span className="font-mono text-stone-600">({activeIntentId})</span> has been
                registered with the gateway. Complete the payment authorization:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSimulateGatewaySuccess}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all"
                >
                  <span>✓ Authorize &amp; Capture</span>
                </button>
                <button
                  type="button"
                  onClick={handleSimulateGatewayFailure}
                  className="py-3 px-4 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl font-bold text-xs border border-rose-300 transition-all"
                >
                  <span>✕ Simulate Bank Decline</span>
                </button>
              </div>
            </div>
          )}

          {paymentStep === 'verifying' && (
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-200 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-stone-700">
                Verifying cryptographic payment signature with marketplace ledger...
              </p>
            </div>
          )}

          {/* Escrow Guarantee Notice */}
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-stone-800">
              <span>✦</span>
              <span>Marketplace Artisan Escrow Guarantee</span>
            </div>
            <p className="leading-relaxed">
              Your payment is held in marketplace escrow and is only disbursed to artisans after
              your handcrafted creations are packaged and dispatched.
            </p>
          </div>
        </div>

        {/* Right Column: Order Summary & Workshop Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800 pb-2 border-b border-stone-100">
              Order Summary
            </h2>

            <div className="flex justify-between items-center text-xs pb-3 border-b border-stone-100">
              <span className="text-stone-500">Order Reference</span>
              <span className="font-mono font-bold text-stone-900">{order.orderNumber}</span>
            </div>

            {/* Sub-Orders Artisan Breakdown */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                Artisan Workshops ({order.subOrders.length})
              </span>
              {order.subOrders.map((subOrder) => (
                <div
                  key={subOrder.id}
                  className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1"
                >
                  <div className="flex justify-between font-bold text-stone-900">
                    <span>{subOrder.shopName}</span>
                    <span>
                      {formatMinorPrice(
                        subOrder.itemSubtotalMinor + subOrder.shippingFeeMinor + subOrder.taxMinor,
                        order.currency,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-500 text-[11px]">
                    <span>Items ({subOrder.itemCount})</span>
                    <span>Sub-order: {subOrder.subOrderNumber}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Row */}
            <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-stone-900">Total Amount Due</span>
              <span className="text-xl font-extrabold text-amber-700">
                {formatMinorPrice(order.totalAmountMinor, order.currency)}
              </span>
            </div>

            {/* Delivery Recipient Snapshot */}
            {order.shippingAddress && (
              <div className="pt-3 border-t border-stone-100 text-xs text-stone-600 space-y-1">
                <span className="font-semibold text-stone-800 block">Delivering To:</span>
                <p className="font-medium text-stone-900">{order.shippingAddress.recipientName}</p>
                <p className="text-stone-500 text-[11px]">
                  {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
                  {order.shippingAddress.postalCode}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="text-center py-16 text-sm text-stone-500">
            Initializing secure payment gateway...
          </div>
        }
      >
        <PaymentContent />
      </Suspense>
    </main>
  );
}
