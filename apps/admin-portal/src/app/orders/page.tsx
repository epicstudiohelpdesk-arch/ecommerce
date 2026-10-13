'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import type { AdminOrderListItemDto } from '@repo/api-contracts';
import type { AdminOrderQuery } from '@repo/validation';
import { getAdminOrders } from '../../lib/api';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [orderStatus, setOrderStatus] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminOrders({
        search: searchQuery.trim() || undefined,
        orderStatus:
          orderStatus === 'ALL' ? undefined : (orderStatus as AdminOrderQuery['orderStatus']),
        paymentStatus:
          paymentStatus === 'ALL' ? undefined : (paymentStatus as AdminOrderQuery['paymentStatus']),
        page,
        limit: 20,
      });
      setOrders(res.items);
      setTotalOrders(res.meta.total);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, orderStatus, paymentStatus, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const formatPrice = (minor: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(minor / 100);
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'PROCESSING':
      case 'PARTIALLY_SHIPPED':
        return <Badge variant="warning">{status.replace('_', ' ')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">CANCELLED</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="success">PAID</Badge>;
      case 'AUTHORIZED':
        return <Badge variant="warning">AUTHORIZED</Badge>;
      case 'FAILED':
      case 'REFUNDED':
        return <Badge variant="destructive">{status}</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
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
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Order Operations Workspace
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Multi-vendor transaction monitoring, autonomous sub-order tracking, customer details,
              and payment statuses.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadOrders()} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh Orders'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Query Failure
          </div>
          <p className="text-sm mt-1 text-rose-300">{error}</p>
        </Card>
      )}

      {/* Filters */}
      <Card className="bg-stone-900 border-stone-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-stone-400 mb-1">Search Orders</label>
            <input
              type="text"
              placeholder="Order #, customer email, or name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Order Status</label>
            <select
              value={orderStatus}
              onChange={(e) => {
                setOrderStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Order Statuses</option>
              <option value="PLACED">Placed</option>
              <option value="PROCESSING">Processing</option>
              <option value="PARTIALLY_SHIPPED">Partially Shipped</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending</option>
              <option value="AUTHORIZED">Authorized</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="bg-stone-900 border-stone-800 overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Marketplace Transactions ({totalOrders})</h2>
          <span className="text-xs text-stone-400">Page {page}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-400 text-xs">
            Querying customer orders from database...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-stone-500 text-xs">
            No orders matching current filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Vendors</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-white font-sans">
                      <Link href={`/orders/${o.id}`} className="text-amber-400 hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="text-stone-200 font-medium">{o.customerName}</div>
                      <div className="text-stone-500 text-[11px] font-mono">{o.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="bg-stone-800 text-stone-300 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {o.subOrderCount} {o.subOrderCount === 1 ? 'vendor' : 'vendors'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans text-stone-300">
                      {o.itemCount}
                    </td>
                    <td className="py-3 px-4 font-sans font-bold text-amber-400">
                      {formatPrice(o.totalAmountMinor)}
                    </td>
                    <td className="py-3 px-4 font-sans">{getOrderStatusBadge(o.orderStatus)}</td>
                    <td className="py-3 px-4 font-sans">
                      {getPaymentStatusBadge(o.paymentStatus)}
                    </td>
                    <td className="py-3 px-4 text-stone-400 whitespace-nowrap text-[11px]">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <Link href={`/orders/${o.id}`}>
                        <Button variant="secondary" size="sm">
                          Inspect &rarr;
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
    </main>
  );
}
