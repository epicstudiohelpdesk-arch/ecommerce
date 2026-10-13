'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge, Card } from '@repo/ui';
import type { AdminDashboardMetricsDto } from '@repo/api-contracts';
import { getAdminDashboardMetrics } from '../../lib/api';

export default function AdminFinancesPage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetricsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadFinances() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdminDashboardMetrics();
        if (isMounted) setMetrics(data);
      } catch (err: unknown) {
        if (isMounted) setError((err as Error).message || 'Failed to load financial ledger data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFinances();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatPrice = (minor: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(minor / 100);
  };

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/"
          className="text-xs font-semibold text-amber-500 hover:text-amber-400 mb-2 inline-block"
        >
          &larr; Back to Platform Overview
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="destructive" size="sm">
                Financial Governance
              </Badge>
              <span className="text-xs text-stone-400">Strict Read-Only Ledger Invariants</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
              Marketplace Commissions & Financial Ledger
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Authoritative payment captures, platform commission reconciliation, artisan payables,
              and immutable audit logs.
            </p>
          </div>
        </div>
      </div>

      {/* Governance Notice Banner */}
      <Card className="bg-amber-950/30 border-amber-800/80 p-4 text-amber-200">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span>⚖️</span> Financial Correctness Precedence
        </div>
        <p className="text-xs text-amber-300 mt-1 leading-relaxed">
          The financial ledger is an append-only double-entry financial accounting system
          established in Gate G09. Arbitrary mutations or ledger edits from the administrative
          interface are strictly prohibited by platform security invariants. Automated payout
          disbursements are segregated and owned exclusively by Gate G16.
        </p>
      </Card>

      {loading && (
        <div className="p-16 text-center text-stone-400 text-xs">
          Querying authoritative ledger aggregates and running automated reconciliation audit...
        </div>
      )}

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Ledger Query Failure
          </div>
          <p className="text-sm mt-1 text-rose-300">{error}</p>
        </Card>
      )}

      {metrics && (
        <div className="space-y-6">
          {/* Top Financial Position Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-stone-900 border-stone-800 p-5 text-white">
              <div className="text-xs uppercase text-stone-400 font-semibold tracking-wider">
                Gross Transaction Volume
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mt-2">
                {formatPrice(metrics.orders.grossMerchandiseValueMinor)}
              </div>
              <div className="text-xs text-stone-400 mt-2">
                Across {metrics.orders.total} total customer orders
              </div>
            </Card>

            <Card className="bg-stone-900 border-stone-800 p-5 text-white">
              <div className="text-xs uppercase text-stone-400 font-semibold tracking-wider">
                Authoritative Captures
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-2">
                {formatPrice(metrics.finances.capturedPaymentsMinor)}
              </div>
              <div className="text-xs text-stone-400 mt-2">Verified gateway captures</div>
            </Card>

            <Card className="bg-stone-900 border-stone-800 p-5 text-white">
              <div className="text-xs uppercase text-stone-400 font-semibold tracking-wider">
                Platform Commission
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-400 mt-2">
                {formatPrice(metrics.finances.platformCommissionsMinor)}
              </div>
              <div className="text-xs text-stone-400 mt-2">Marketplace retained share</div>
            </Card>

            <Card className="bg-stone-900 border-stone-800 p-5 text-white">
              <div className="text-xs uppercase text-stone-400 font-semibold tracking-wider">
                Artisan Payables
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mt-2">
                {formatPrice(metrics.finances.sellerPayablesMinor)}
              </div>
              <div className="text-xs text-stone-400 mt-2">Attributable seller entitlements</div>
            </Card>
          </div>

          {/* Automated Reconciliation Verification Strip */}
          <Card className="bg-stone-900 border-stone-800 p-6 text-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-800 pb-3">
              <div>
                <h3 className="font-bold text-base">Continuous Automated Reconciliation Audit</h3>
                <p className="text-xs text-stone-400">
                  Deterministic verification: Captured minor == Sum(Sub-Order Totals)
                </p>
              </div>

              {metrics.finances.reconciliationDiscrepancies === 0 ? (
                <Badge variant="success">INVARIANT BALANCED (0 DISCREPANCIES)</Badge>
              ) : (
                <Badge variant="destructive">
                  {metrics.finances.reconciliationDiscrepancies} DISCREPANCIES FLAGGED
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
                <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                  Gateway Integration Status
                </span>
                <div className="font-bold text-emerald-400 text-sm mt-1">
                  RAZORPAY & STRIPE PRODUCTION READY
                </div>
                <p className="text-stone-400 mt-1">
                  Webhook signatures cryptographically authenticated and idempotently deduplicated.
                </p>
              </div>

              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
                <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                  Ledger Partition Rule
                </span>
                <div className="font-bold text-white text-sm mt-1">
                  AUTONOMOUS ARTISAN PARTITIONS
                </div>
                <p className="text-stone-400 mt-1">
                  Each sub-order preserves distinct commission calculation, shipping fee partition,
                  and seller payout entitlement.
                </p>
              </div>

              <div className="bg-stone-950 p-4 rounded-lg border border-stone-800">
                <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                  Disbursement Ownership
                </span>
                <div className="font-bold text-amber-400 text-sm mt-1">
                  GATE G16 BOUNDARY ENFORCED
                </div>
                <p className="text-stone-400 mt-1">
                  Banking integrations, NEFT/IMPS payout triggers, and 1099/TDS tax deductions are
                  reserved for G16.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
