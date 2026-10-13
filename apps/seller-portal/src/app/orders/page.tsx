'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, Input, LoadingSpinner, EmptyState } from '@repo/ui';
import { formatCurrency } from '@repo/shared';
import { getSellerOrders } from '../../lib/api';
import type { SellerSubOrderSummaryDto } from '@repo/api-contracts';
import type { SellerSubOrderStatus } from '@repo/validation';

const STATUS_FILTERS: { label: string; value: 'ALL' | SellerSubOrderStatus }[] = [
  { label: 'All Orders', value: 'ALL' },
  { label: 'Confirmed (Needs Action)', value: 'CONFIRMED' },
  { label: 'In Production', value: 'IN_PRODUCTION' },
  { label: 'Ready for Pickup', value: 'READY_FOR_PICKUP' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return <Badge variant="warning">Confirmed • Needs Action</Badge>;
    case 'IN_PRODUCTION':
      return <Badge variant="default">In Production</Badge>;
    case 'READY_FOR_PICKUP':
      return <Badge variant="success">Ready for Pickup</Badge>;
    case 'SHIPPED':
      return <Badge variant="default">In Transit</Badge>;
    case 'DELIVERED':
    case 'COMPLETED':
      return <Badge variant="success">Completed</Badge>;
    case 'CANCELLED':
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export default function SellerOrdersPage() {
  const [activeStatus, setActiveStatus] = useState<'ALL' | SellerSubOrderStatus>('ALL');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState<SellerSubOrderSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getSellerOrders({
      status: activeStatus,
      search: search.trim() || undefined,
    })
      .then((res) => {
        if (isMounted) {
          setOrders(res.items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeStatus, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title & Description */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 tracking-tight">
            Orders & Production
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Track handcrafted sub-orders, handle custom personalisation requests, and manage
            fulfillment.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveStatus(f.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                activeStatus === f.value
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search order # or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      {/* Orders Table Card */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size="md" />
          </div>
        ) : orders.length === 0 ? (
          <div className="py-16">
            <EmptyState
              title="No sub-orders found"
              description={
                search
                  ? `No orders matching "${search}" for the selected filter.`
                  : 'You have no orders in this fulfillment state.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/75 text-stone-500 uppercase tracking-wider text-[11px] font-semibold">
                  <th className="py-3 px-4">Sub-Order #</th>
                  <th className="py-3 px-4">Date Placed</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Net Payout</th>
                  <th className="py-3 px-4">Fulfillment Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-bold text-amber-900 hover:underline"
                      >
                        {o.subOrderNumber}
                      </Link>
                      <div className="text-[11px] text-stone-400">Ref: {o.parentOrderNumber}</div>
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      <div className="text-[11px] text-stone-400">
                        {new Date(o.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-stone-700">
                      <span className="font-semibold">{o.itemCount} item(s)</span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-600">
                      {o.recipientCity ? (
                        <span>
                          {o.recipientCity}, {o.recipientState}
                          <span className="block text-[11px] text-stone-400">
                            PIN: {o.recipientPostalCode}
                          </span>
                        </span>
                      ) : (
                        <span className="text-stone-400">Standard Delivery</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-stone-900">
                        {formatCurrency(o.netSellerPayableMinor, 'INR', 'en-IN')}
                      </span>
                      <span className="block text-[11px] text-stone-400">
                        Gross: {formatCurrency(o.itemSubtotalMinor, 'INR', 'en-IN')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(o.status)}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link href={`/orders/${o.id}`}>
                        <Button variant="outline" size="sm">
                          {o.status === 'CONFIRMED'
                            ? 'Fulfill Order'
                            : o.status === 'IN_PRODUCTION'
                              ? 'Update Progress'
                              : 'View Details'}
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
