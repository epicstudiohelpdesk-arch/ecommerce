'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, LoadingSpinner } from '@repo/ui';
import { formatCurrency } from '@repo/shared';
import { getSellerDashboard } from '../lib/api';
import type { SellerDashboardDto } from '@repo/api-contracts';

export default function SellerStudioDashboard() {
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('7d');
  const [dashboard, setDashboard] = useState<SellerDashboardDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getSellerDashboard(period)
      .then((data) => {
        if (isMounted) {
          setDashboard(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [period]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header with Artisan Greeting & Period Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
              Artisan Studio Hub
            </h1>
            <Badge variant="success" size="sm" withDot>
              Active Shop
            </Badge>
          </div>
          <p className="text-sm text-stone-600 mt-1">
            Real-time business overview, order fulfillment, and handcrafted performance.
          </p>
        </div>

        {/* Date Filter & Quick Listing Button */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-stone-300 bg-stone-50 p-1">
            {(['today', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  period === p
                    ? 'bg-white text-stone-900 shadow-sm font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>

          <Link href="/products/new">
            <Button variant="primary" size="sm">
              + New Listing
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      ) : !dashboard ? (
        <div className="text-center py-16 text-stone-500">
          Unable to load dashboard data. Please refresh.
        </div>
      ) : (
        <>
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 border-l-4 border-l-amber-600">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Gross Sales ({period})
              </span>
              <div className="text-2xl font-bold text-stone-900 mt-1">
                {formatCurrency(dashboard.metrics.grossSalesMinor, 'INR', 'en-IN')}
              </div>
              <p className="text-xs text-stone-500 mt-2">
                Across {dashboard.metrics.ordersCount} customer orders
              </p>
            </Card>

            <Card className="p-5 border-l-4 border-l-emerald-600">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Net Artisan Earnings
              </span>
              <div className="text-2xl font-bold text-emerald-800 mt-1">
                {formatCurrency(dashboard.metrics.netPayableMinor, 'INR', 'en-IN')}
              </div>
              <p className="text-xs text-stone-500 mt-2">
                After platform craft commission deduction
              </p>
            </Card>

            <Card className="p-5 border-l-4 border-l-rose-500">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Action-Required Orders
              </span>
              <div className="text-2xl font-bold text-stone-900 mt-1 flex items-center justify-between">
                <span>{dashboard.metrics.actionRequiredOrdersCount}</span>
                {dashboard.metrics.actionRequiredOrdersCount > 0 && (
                  <Badge variant="warning" size="sm">
                    Needs Action
                  </Badge>
                )}
              </div>
              <Link
                href="/orders?status=CONFIRMED"
                className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-block mt-2"
              >
                View pending orders →
              </Link>
            </Card>

            <Card className="p-5 border-l-4 border-l-stone-600">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Catalogue & Stock
              </span>
              <div className="text-2xl font-bold text-stone-900 mt-1">
                {dashboard.metrics.publishedProductsCount}{' '}
                <span className="text-sm font-normal text-stone-500">Active Listings</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs">
                {dashboard.metrics.lowStockVariantsCount > 0 ? (
                  <span className="text-amber-700 font-medium">
                    ⚠️ {dashboard.metrics.lowStockVariantsCount} low stock
                  </span>
                ) : (
                  <span className="text-stone-500">Inventory healthy</span>
                )}
              </div>
            </Card>
          </div>

          {/* Action Items Banner Checklist */}
          {dashboard.actionItems.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                  <span>⚡</span> Prioritized Action Items
                </h2>
                <span className="text-xs text-amber-800 font-medium">
                  {dashboard.actionItems.length} items to review
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {dashboard.actionItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.actionUrl}
                    className="p-3 bg-white rounded-lg border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">
                          {item.title}
                        </span>
                        {item.severity === 'HIGH' && (
                          <Badge variant="destructive" size="sm">
                            High
                          </Badge>
                        )}
                        {item.severity === 'MEDIUM' && (
                          <Badge variant="warning" size="sm">
                            Medium
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-2">{item.description}</p>
                    </div>
                    <span className="text-[11px] text-amber-700 font-semibold mt-3 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      {item.actionLabel} →
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Main 2-Column Section: Financial Position & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Financial Position Card (2 cols on large screen) */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between border-b border-stone-200 pb-4 mb-5">
                  <div>
                    <h2 className="text-lg font-bold text-stone-900 font-serif">
                      Financial Position & Payout Ledger
                    </h2>
                    <p className="text-xs text-stone-500">
                      Authoritative financial accounting integrated with platform escrow.
                    </p>
                  </div>
                  <Link href="/finances">
                    <Button variant="ghost" size="sm">
                      View Full Ledger →
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-50/60 border border-emerald-100">
                    <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                      Available for Next Payout
                    </span>
                    <div className="text-2xl font-bold text-emerald-800 mt-1">
                      {formatCurrency(
                        dashboard.financialPosition.availablePayoutMinor,
                        'INR',
                        'en-IN',
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-2">
                      Cleared funds eligible for bank disbursement
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-stone-50 border border-stone-200">
                    <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                      In Delivery Escrow
                    </span>
                    <div className="text-2xl font-bold text-stone-800 mt-1">
                      {formatCurrency(
                        dashboard.financialPosition.pendingEscrowMinor,
                        'INR',
                        'en-IN',
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-2">
                      Held until delivery confirmation
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-100">
                    <span className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
                      Lifetime Earnings
                    </span>
                    <div className="text-2xl font-bold text-amber-900 mt-1">
                      {formatCurrency(
                        dashboard.financialPosition.lifetimePayoutMinor,
                        'INR',
                        'en-IN',
                      )}
                    </div>
                    <p className="text-[11px] text-amber-700 mt-2">
                      Total settled sales since opening shop
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                  <span>
                    ℹ️ Marketplace commissions are deducted automatically per craft category.
                  </span>
                  <span className="font-medium text-stone-700">Currency: INR (₹)</span>
                </div>
              </Card>

              {/* Quick Workspace Shortcuts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link
                  href="/orders"
                  className="p-4 rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all block group"
                >
                  <span className="text-xl">📦</span>
                  <h3 className="text-sm font-bold text-stone-900 group-hover:text-amber-800 transition-colors mt-2">
                    Orders & Fulfillment
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Manage crafting workflow, custom buyer requests, and dispatch.
                  </p>
                </Link>

                <Link
                  href="/inventory"
                  className="p-4 rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all block group"
                >
                  <span className="text-xl">📊</span>
                  <h3 className="text-sm font-bold text-stone-900 group-hover:text-amber-800 transition-colors mt-2">
                    Stock & Reserves
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Track on-hand ceramics, woodcraft, and prevent stockouts.
                  </p>
                </Link>

                <Link
                  href="/shop"
                  className="p-4 rounded-xl border border-stone-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all block group"
                >
                  <span className="text-xl">🏺</span>
                  <h3 className="text-sm font-bold text-stone-900 group-hover:text-amber-800 transition-colors mt-2">
                    Shop Profile & Story
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    Tell your artisan heritage and set vacation mode.
                  </p>
                </Link>
              </div>
            </div>

            {/* Recent Activity Feed (1 col on right) */}
            <div className="space-y-6">
              <Card className="p-6">
                <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
                  <h2 className="text-base font-bold text-stone-900 font-serif">
                    Recent Studio Activity
                  </h2>
                  <span className="text-xs text-stone-500">Live</span>
                </div>

                <div className="space-y-4">
                  {dashboard.recentActivity.map((act) => (
                    <div key={act.id} className="flex items-start gap-3 text-xs">
                      <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center shrink-0 text-stone-600 font-bold mt-0.5">
                        {act.type === 'ORDER_RECEIVED'
                          ? '🛒'
                          : act.type === 'ORDER_STATUS_CHANGED'
                            ? '🔨'
                            : '📦'}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-stone-800">{act.title}</p>
                        <p className="text-stone-500 text-[11px] mt-0.5">{act.description}</p>
                        <span className="text-[10px] text-stone-400 mt-1 block">
                          {new Date(act.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-stone-100 text-center">
                  <Link
                    href="/notifications"
                    className="text-xs font-semibold text-amber-800 hover:text-amber-900"
                  >
                    View all notifications →
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
