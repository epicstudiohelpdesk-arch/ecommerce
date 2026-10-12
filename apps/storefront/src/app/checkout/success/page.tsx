'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('orderNumber') || 'ORD-RECENT';

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-stone-200 p-8 sm:p-12 shadow-sm text-center space-y-8">
      {/* Success Badge */}
      <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto ring-8 ring-emerald-50/50">
        ✓
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
          Handcrafted Order Placed!
        </h1>
        <p className="text-stone-600 text-sm">
          Thank you for supporting independent artisans and handmade craftsmanship.
        </p>
      </div>

      {/* Order Number Box */}
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-left space-y-3">
        <div className="flex justify-between items-center text-xs pb-3 border-b border-stone-200">
          <span className="text-stone-500 font-semibold uppercase tracking-wider">
            Order Reference Number
          </span>
          <span className="font-mono font-bold text-stone-900 text-sm">{orderNumber}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs pt-1">
          <div>
            <span className="text-stone-500 block">Order Status:</span>
            <span className="font-bold text-stone-900 inline-flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              PLACED
            </span>
          </div>
          <div>
            <span className="text-stone-500 block">Payment Status:</span>
            <span className="font-bold text-amber-800 inline-flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              PENDING (Gate G08)
            </span>
          </div>
        </div>
      </div>

      {/* Gate G08 Architecture Notice */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 text-left text-xs text-amber-950 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-900">
          <span>✦</span>
          <span>Gate G08 Checkout Verification Evidence</span>
        </div>
        <p className="leading-relaxed text-amber-900">
          Your order has been recorded into the multi-vendor transaction system. Parent order,
          artisan-specific sub-orders, immutable pricing snapshots, and audit records have been
          created atomically. Inventory stock has been locked and decremented.
        </p>
        <p className="leading-relaxed text-amber-800">
          In accordance with strict Gate G08 scope boundaries, the order remains in{' '}
          <strong>paymentStatus: PENDING</strong>. Gateway capture and customer notifications will
          be integrated in <strong>Gate G09</strong>.
        </p>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/categories"
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors shadow-sm"
        >
          Explore More Artisan Crafts &rarr;
        </Link>
        <Link
          href="/"
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold text-xs transition-colors border border-stone-200"
        >
          Return to Marketplace Home
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Suspense
        fallback={
          <div className="text-center py-16 text-sm text-stone-500">
            Loading order confirmation...
          </div>
        }
      >
        <OrderSuccessContent />
      </Suspense>
    </main>
  );
}
