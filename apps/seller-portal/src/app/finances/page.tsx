'use client';

import React, { useEffect, useState } from 'react';
import { Card, Badge, LoadingSpinner } from '@repo/ui';
import { formatCurrency } from '@repo/shared';
import { getSellerDashboard } from '../../lib/api';
import type { SellerDashboardDto } from '@repo/api-contracts';

interface LedgerStatementEntry {
  id: string;
  date: string;
  type: 'ESCROW_CREDIT' | 'ESCROW_RELEASE' | 'COMMISSION_DEDUCTION' | 'PAYOUT';
  referenceOrder: string;
  grossAmountMinor: number;
  commissionFeeMinor: number;
  netAmountMinor: number;
  status: 'SETTLED' | 'PENDING';
}

const SAMPLE_LEDGER_ENTRIES: LedgerStatementEntry[] = [
  {
    id: 'led-1',
    date: '2026-10-13T08:45:00.000Z',
    type: 'ESCROW_CREDIT',
    referenceOrder: 'SUB-2026-9812',
    grossAmountMinor: 175000,
    commissionFeeMinor: 26250,
    netAmountMinor: 148750,
    status: 'PENDING',
  },
  {
    id: 'led-2',
    date: '2026-10-12T15:20:00.000Z',
    type: 'ESCROW_RELEASE',
    referenceOrder: 'SUB-2026-9750',
    grossAmountMinor: 89000,
    commissionFeeMinor: 13350,
    netAmountMinor: 75650,
    status: 'SETTLED',
  },
  {
    id: 'led-3',
    date: '2026-10-10T11:00:00.000Z',
    type: 'ESCROW_RELEASE',
    referenceOrder: 'SUB-2026-9710',
    grossAmountMinor: 350000,
    commissionFeeMinor: 52500,
    netAmountMinor: 297500,
    status: 'SETTLED',
  },
  {
    id: 'led-4',
    date: '2026-10-05T09:30:00.000Z',
    type: 'ESCROW_RELEASE',
    referenceOrder: 'SUB-2026-9680',
    grossAmountMinor: 240000,
    commissionFeeMinor: 36000,
    netAmountMinor: 204000,
    status: 'SETTLED',
  },
];

export default function SellerFinancesPage() {
  const [dashboard, setDashboard] = useState<SellerDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getSellerDashboard('30d')
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
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title Header */}
      <div className="border-b border-stone-200 pb-5">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
          Financial Position & Escrow Ledger
        </h1>
        <p className="text-sm text-stone-600 mt-1">
          Transparent, double-entry financial accounting integrated with platform escrow and
          automated commissions.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-28">
          <LoadingSpinner size="lg" />
        </div>
      ) : !dashboard ? (
        <div className="py-16 text-center text-stone-500">Unable to load financial position.</div>
      ) : (
        <>
          {/* Financial Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-l-4 border-l-emerald-600 bg-emerald-50/20">
              <span className="text-xs uppercase tracking-wider text-emerald-800 font-bold">
                Available for Payout
              </span>
              <div className="text-3xl font-bold text-emerald-800 mt-2">
                {formatCurrency(dashboard.financialPosition.availablePayoutMinor, 'INR', 'en-IN')}
              </div>
              <p className="text-xs text-stone-500 mt-3">
                Cleared funds where the order has been delivered and the dispute window has elapsed.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-l-stone-600">
              <span className="text-xs uppercase tracking-wider text-stone-600 font-bold">
                In Delivery Escrow
              </span>
              <div className="text-3xl font-bold text-stone-800 mt-2">
                {formatCurrency(dashboard.financialPosition.pendingEscrowMinor, 'INR', 'en-IN')}
              </div>
              <p className="text-xs text-stone-500 mt-3">
                Customer funds securely held in escrow while your handcrafted creation is in
                production or transit.
              </p>
            </Card>

            <Card className="p-6 border-l-4 border-l-amber-600 bg-amber-50/20">
              <span className="text-xs uppercase tracking-wider text-amber-900 font-bold">
                Lifetime Marketplace Earnings
              </span>
              <div className="text-3xl font-bold text-amber-900 mt-2">
                {formatCurrency(dashboard.financialPosition.lifetimePayoutMinor, 'INR', 'en-IN')}
              </div>
              <p className="text-xs text-stone-500 mt-3">
                Cumulative net revenue earned by your artisan studio since opening.
              </p>
            </Card>
          </div>

          {/* Transparent Commission & Ledger Invariant Information */}
          <div className="p-5 rounded-xl bg-stone-100/80 border border-stone-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-stone-600">
            <div className="space-y-1">
              <span className="font-bold text-stone-900 flex items-center gap-1.5">
                <span>⚖️</span> Authoritative Double-Entry Financial Ledger
              </span>
              <p>
                Every monetary transaction is mathematically balanced across Platform Escrow,
                Marketplace Commission Revenue, and Seller Payable Accounts.
              </p>
            </div>
            <div className="shrink-0">
              <Badge variant="default">Read-Only Financial View</Badge>
            </div>
          </div>

          {/* Statement Journal Table */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-stone-900 font-serif">
                  Recent Ledger Transactions
                </h2>
                <p className="text-xs text-stone-500">
                  Itemised debits and credits recorded for your sub-orders.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 uppercase tracking-wider text-[11px] font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Reference Order</th>
                    <th className="py-2.5 px-3 text-right">Order Gross</th>
                    <th className="py-2.5 px-3 text-right">Commission Fee</th>
                    <th className="py-2.5 px-3 text-right">Net Payable</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {SAMPLE_LEDGER_ENTRIES.map((entry) => (
                    <tr key={entry.id} className="hover:bg-stone-50/60">
                      <td className="py-3 px-3 text-stone-600 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-3 font-semibold text-stone-800">
                        {entry.type === 'ESCROW_CREDIT'
                          ? 'Escrow Hold'
                          : entry.type === 'ESCROW_RELEASE'
                            ? 'Funds Cleared'
                            : entry.type}
                      </td>
                      <td className="py-3 px-3 font-mono text-stone-700">{entry.referenceOrder}</td>
                      <td className="py-3 px-3 text-right text-stone-700">
                        {formatCurrency(entry.grossAmountMinor, 'INR', 'en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700">
                        -{formatCurrency(entry.commissionFeeMinor, 'INR', 'en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-800">
                        {formatCurrency(entry.netAmountMinor, 'INR', 'en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          variant={entry.status === 'SETTLED' ? 'success' : 'warning'}
                          size="sm"
                        >
                          {entry.status}
                        </Badge>
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
