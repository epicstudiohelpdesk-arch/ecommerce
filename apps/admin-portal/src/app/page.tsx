'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Card, Button } from '@repo/ui';
import { getAdminDashboardMetrics } from '../lib/api';
import type { AdminDashboardMetricsDto } from '@repo/api-contracts';

export default function AdminPortalHomePage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadMetrics() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdminDashboardMetrics();
        if (isMounted) {
          setMetrics(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError((err as Error).message || 'Failed to fetch operational dashboard metrics');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadMetrics();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatCurrency = (minor: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(minor / 100);
  };

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-800 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" size="sm">
              Operational Oversight
            </Badge>
            <span className="text-xs text-stone-400">Live PostgreSQL Metrics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Platform Command Center
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Authoritative marketplace metrics, seller verifications, catalog moderation, and audit
            compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/sellers">
            <Button variant="secondary" size="sm">
              Artisan KYC Queue
            </Button>
          </Link>
          <Link href="/moderation">
            <Button variant="primary" size="sm">
              Product Moderation
            </Button>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center text-stone-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mb-2"></div>
          <p className="text-sm">Querying real database aggregate statistics...</p>
        </div>
      )}

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Communication Warning
          </div>
          <p className="text-sm mt-1 text-rose-300">
            {error}. Ensure the API server is running on port 4000.
          </p>
        </Card>
      )}

      {metrics && (
        <>
          {/* Top Domain Aggregate Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sellers Card */}
            <Card className="bg-stone-900 border-stone-800 text-white p-5">
              <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider">
                <span>Artisan Sellers</span>
                <Link href="/sellers" className="text-amber-400 hover:underline">
                  View &rarr;
                </Link>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{metrics.sellers.total}</span>
                <span className="text-xs text-stone-400">total accounts</span>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-amber-400 font-bold">
                    {metrics.sellers.pendingVerification}
                  </div>
                  <div className="text-stone-400 text-[10px]">Pending</div>
                </div>
                <div>
                  <div className="text-emerald-400 font-bold">{metrics.sellers.approved}</div>
                  <div className="text-stone-400 text-[10px]">Verified</div>
                </div>
                <div>
                  <div className="text-rose-400 font-bold">{metrics.sellers.suspended}</div>
                  <div className="text-stone-400 text-[10px]">Suspended</div>
                </div>
              </div>
            </Card>

            {/* Catalog & Moderation Card */}
            <Card className="bg-stone-900 border-stone-800 text-white p-5">
              <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider">
                <span>Catalogue & Moderation</span>
                <Link href="/moderation" className="text-amber-400 hover:underline">
                  View &rarr;
                </Link>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{metrics.products.total}</span>
                <span className="text-xs text-stone-400">craft listings</span>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-amber-400 font-bold">
                    {metrics.products.pendingModeration}
                  </div>
                  <div className="text-stone-400 text-[10px]">In Review</div>
                </div>
                <div>
                  <div className="text-emerald-400 font-bold">{metrics.products.published}</div>
                  <div className="text-stone-400 text-[10px]">Live</div>
                </div>
                <div>
                  <div className="text-rose-400 font-bold">{metrics.products.rejected}</div>
                  <div className="text-stone-400 text-[10px]">Rejected</div>
                </div>
              </div>
            </Card>

            {/* Orders & GMV Card */}
            <Card className="bg-stone-900 border-stone-800 text-white p-5">
              <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider">
                <span>Orders & Volume</span>
                <Link href="/orders" className="text-amber-400 hover:underline">
                  View &rarr;
                </Link>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{metrics.orders.total}</span>
                <span className="text-xs text-stone-400">orders</span>
              </div>
              <div className="mt-2 text-sm text-stone-300 font-medium">
                GMV:{' '}
                <span className="text-amber-400 font-bold">
                  {formatCurrency(metrics.orders.grossMerchandiseValueMinor)}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-stone-800 flex justify-between text-xs text-stone-400">
                <span>
                  Processing:{' '}
                  <strong className="text-stone-200">{metrics.orders.processing}</strong>
                </span>
                <span>
                  Completed:{' '}
                  <strong className="text-emerald-400">{metrics.orders.completed}</strong>
                </span>
              </div>
            </Card>

            {/* Fulfilment & Couriers Card */}
            <Card className="bg-stone-900 border-stone-800 text-white p-5">
              <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider">
                <span>Fulfilment Oversight</span>
                <Link href="/shipments" className="text-amber-400 hover:underline">
                  View &rarr;
                </Link>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{metrics.fulfilment.totalShipments}</span>
                <span className="text-xs text-stone-400">total shipments</span>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-amber-400 font-bold">{metrics.fulfilment.pendingPickup}</div>
                  <div className="text-stone-400 text-[10px]">Pending</div>
                </div>
                <div>
                  <div className="text-blue-400 font-bold">{metrics.fulfilment.inTransit}</div>
                  <div className="text-stone-400 text-[10px]">In Transit</div>
                </div>
                <div>
                  <div className="text-rose-400 font-bold">
                    {metrics.fulfilment.deliveryExceptions}
                  </div>
                  <div className="text-stone-400 text-[10px]">Exceptions</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Financial Oversight Ledger Strip */}
          <Card className="bg-stone-900 border-stone-800 p-6 text-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-800 pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Authoritative Financial Ledger Position
                </h2>
                <p className="text-xs text-stone-400">
                  Strictly computed from verified gateway captures and ledger sub-orders
                </p>
              </div>
              <Link href="/finances">
                <Button variant="secondary" size="sm">
                  Full Ledger & Reconciliation &rarr;
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800/80">
                <div className="text-xs uppercase text-stone-400 font-medium">
                  Captured Payments
                </div>
                <div className="text-2xl font-bold text-white mt-1">
                  {formatCurrency(metrics.finances.capturedPaymentsMinor)}
                </div>
                <div className="text-[11px] text-emerald-400 mt-1">Authorized Gateway Captures</div>
              </div>

              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800/80">
                <div className="text-xs uppercase text-stone-400 font-medium">
                  Platform Commissions
                </div>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  {formatCurrency(metrics.finances.platformCommissionsMinor)}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">Marketplace Retained Share</div>
              </div>

              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800/80">
                <div className="text-xs uppercase text-stone-400 font-medium">
                  Artisan Net Payables
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  {formatCurrency(metrics.finances.sellerPayablesMinor)}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">Attributable to Artisans</div>
              </div>

              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800/80">
                <div className="text-xs uppercase text-stone-400 font-medium">
                  Audit Discrepancies
                </div>
                <div className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                  <span>{metrics.finances.reconciliationDiscrepancies}</span>
                  {metrics.finances.reconciliationDiscrepancies === 0 ? (
                    <Badge variant="success" size="sm">
                      BALANCED
                    </Badge>
                  ) : (
                    <Badge variant="destructive" size="sm">
                      FLAGGED
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-stone-400 mt-1">Deterministic Invariant Check</div>
              </div>
            </div>
          </Card>

          {/* Recent Audit Log Stream */}
          <Card className="bg-stone-900 border-stone-800 p-6 text-white">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">
                  Recent Immutable Audit Activity
                </h2>
                <p className="text-xs text-stone-400">
                  Last security and operational events logged to append-only audit register
                </p>
              </div>
              <Link href="/audit">
                <Button variant="secondary" size="sm">
                  All Audit Logs &rarr;
                </Button>
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              {metrics.recentAuditLogs.length === 0 ? (
                <p className="text-sm text-stone-500 py-4">No audit events recorded yet.</p>
              ) : (
                <table className="w-full text-left text-xs text-stone-300">
                  <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Resource Type</th>
                      <th className="py-2.5 px-3">Resource ID</th>
                      <th className="py-2.5 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 font-mono">
                    {metrics.recentAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-stone-800/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-stone-400">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="px-1.5 py-0.5 rounded bg-stone-800 text-[11px] font-semibold text-amber-300 border border-stone-700">
                            {log.actorRole}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white font-sans">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-3 text-stone-300">{log.resourceType}</td>
                        <td
                          className="py-2.5 px-3 text-stone-400 max-w-[140px] truncate"
                          title={log.resourceId ?? ''}
                        >
                          {log.resourceId ? `${log.resourceId.slice(0, 8)}...` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          <Link
                            href={`/audit?search=${log.id}`}
                            className="text-amber-400 hover:underline"
                          >
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
