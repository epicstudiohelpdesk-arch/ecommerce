'use client';

import React, { useEffect, useState } from 'react';
import { Card, LoadingSpinner } from '@repo/ui';
import { formatCurrency } from '@repo/shared';
import { getSellerPerformanceAnalytics } from '../../lib/api';
import type { SellerAnalyticsPerformanceDto } from '@repo/api-contracts';

export default function SellerPerformancePage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [data, setData] = useState<SellerAnalyticsPerformanceDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getSellerPerformanceAnalytics(period)
      .then((res) => {
        if (isMounted) {
          setData(res);
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

  const maxDailyRevenue =
    data?.salesTrend.reduce((max, d) => Math.max(max, d.grossSalesMinor), 1) || 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header and Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
            Sales & Craft Performance
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Understand which handcrafted creations resonate with customers and track order volume.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-stone-300 bg-stone-50 p-1">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p
                  ? 'bg-white text-stone-900 shadow-sm font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {p === '7d' ? 'Last 7 Days' : p === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-28">
          <LoadingSpinner size="lg" />
        </div>
      ) : !data ? (
        <div className="py-16 text-center text-stone-500">
          No analytics data available for this timeframe.
        </div>
      ) : (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Gross Sales ({period})
              </span>
              <div className="text-2xl font-bold text-stone-900 mt-1">
                {formatCurrency(data.summary.grossSalesMinor, 'INR', 'en-IN')}
              </div>
              <p className="text-xs text-stone-500 mt-2">Before platform commission</p>
            </Card>

            <Card className="p-5">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Total Orders Placed
              </span>
              <div className="text-2xl font-bold text-stone-900 mt-1">
                {data.summary.totalOrders}
              </div>
              <p className="text-xs text-stone-500 mt-2">Delivered and in production</p>
            </Card>

            <Card className="p-5">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Average Order Value (AOV)
              </span>
              <div className="text-2xl font-bold text-amber-900 mt-1">
                {formatCurrency(data.summary.averageOrderValueMinor, 'INR', 'en-IN')}
              </div>
              <p className="text-xs text-stone-500 mt-2">Basket size across customers</p>
            </Card>

            <Card className="p-5">
              <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
                Cancellation Rate
              </span>
              <div className="text-2xl font-bold text-emerald-800 mt-1">
                {(data.summary.cancellationRateBps / 100).toFixed(1)}%
              </div>
              <p className="text-xs text-stone-500 mt-2">
                {data.summary.cancellationRateBps === 0
                  ? 'Excellent artisan fulfillment track record'
                  : 'Orders cancelled during window'}
              </p>
            </Card>
          </div>

          {/* Sales Trend Visualizer */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-stone-900 font-serif">Daily Sales Trend</h2>
                <p className="text-xs text-stone-500">
                  Daily gross revenue and order frequency across {period}.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {data.salesTrend.map((trend) => {
                const pct = Math.round((trend.grossSalesMinor / maxDailyRevenue) * 100);
                return (
                  <div key={trend.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span className="font-semibold text-stone-800">
                        {new Date(trend.date).toLocaleDateString('en-IN', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-stone-500">{trend.ordersCount} order(s)</span>
                        <span className="font-bold text-stone-900">
                          {formatCurrency(trend.grossSalesMinor, 'INR', 'en-IN')}
                        </span>
                      </div>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-amber-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Handcrafted Products Table */}
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 font-serif">
                Top Performing Handcrafted Creations
              </h2>
              <p className="text-xs text-stone-500">
                Ranked by volume of handmade units crafted and sold.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Product Title</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-center">Units Sold</th>
                    <th className="py-2.5 px-3 text-right">Gross Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.topProducts.map((p, idx) => (
                    <tr key={p.variantId} className="hover:bg-stone-50/60">
                      <td className="py-3 px-3 font-bold text-stone-400">#{idx + 1}</td>
                      <td className="py-3 px-3 font-semibold text-stone-900">{p.title}</td>
                      <td className="py-3 px-3 font-mono text-stone-500">{p.sku}</td>
                      <td className="py-3 px-3 text-center font-bold text-amber-900">
                        {p.unitsSold}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-stone-900">
                        {formatCurrency(p.totalRevenueMinor, 'INR', 'en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
