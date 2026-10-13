'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Badge, Card } from '@repo/ui';
import type { AdminOrderDetailDto } from '@repo/api-contracts';
import { getAdminOrderDetail } from '../../../lib/api';

export default function AdminOrderDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;

  const [order, setOrder] = useState<AdminOrderDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchDetail() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdminOrderDetail(orderId);
        if (isMounted) setOrder(data);
      } catch (err: unknown) {
        if (isMounted) setError((err as Error).message || 'Failed to fetch order detail');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

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

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      <div>
        <Link
          href="/orders"
          className="text-xs font-semibold text-amber-500 hover:text-amber-400 mb-2 inline-block"
        >
          &larr; Back to Order Operations Workspace
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
                Order {order?.orderNumber || orderId}
              </h1>
              {order && getOrderStatusBadge(order.orderStatus)}
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Multi-vendor transaction aggregate id:{' '}
              <span className="font-mono text-stone-300">{orderId}</span>
            </p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-16 text-center text-stone-400 text-xs">
          Loading order hierarchy, sub-orders, and payment telemetry...
        </div>
      )}

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Order Fetch Error
          </div>
          <p className="text-sm mt-1 text-rose-300">{error}</p>
        </Card>
      )}

      {order && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Multi-Vendor Sub-Orders & Items (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Artisan Sub-Orders ({order.subOrders.length})</span>
              <span className="text-xs font-normal text-stone-400">
                &bull; Autonomous fulfillment partitions
              </span>
            </h2>

            {order.subOrders.map((so) => (
              <Card key={so.id} className="bg-stone-900 border-stone-800 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-800 gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-400 font-mono">
                        {so.subOrderNumber}
                      </span>
                      <span className="text-stone-500 text-xs">&bull;</span>
                      <span className="text-sm font-semibold text-white">{so.shopName}</span>
                    </div>
                    <div className="text-xs text-stone-400">Legal: {so.sellerLegalName}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="default" size="sm">
                      {so.subOrderStatus}
                    </Badge>
                    <span className="text-sm font-bold text-white">
                      {formatPrice(so.itemSubtotalMinor)}
                    </span>
                  </div>
                </div>

                {/* Items in sub-order */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-semibold text-stone-400 tracking-wider">
                    Purchased Craft Items ({so.items.length})
                  </h4>
                  <div className="divide-y divide-stone-800/80">
                    {so.items.map((item) => (
                      <div
                        key={item.id}
                        className="py-2.5 flex items-start justify-between gap-4 text-xs"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-white">{item.productTitle}</div>
                          <div className="text-stone-400 font-mono text-[11px] mt-0.5">
                            SKU: {item.sku}
                          </div>
                          {item.customisationNote && (
                            <div className="text-amber-300 text-[11px] bg-stone-950 p-1.5 rounded mt-1.5 border border-amber-900/40">
                              Custom Note: &ldquo;{item.customisationNote}&rdquo;
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-stone-300">
                            {item.quantity} &times; {formatPrice(item.unitPriceMinor)}
                          </div>
                          <div className="font-bold text-white mt-0.5">
                            {formatPrice(item.totalPriceMinor)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping & Courier for Sub-order */}
                <div className="pt-3 border-t border-stone-800/80 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-stone-300 gap-2">
                  <div>
                    <span className="text-stone-400">Shipment Status: </span>
                    {so.shipment ? (
                      <span className="font-medium text-white">
                        {so.shipment.carrier} ({so.shipment.status}) &bull; Tracking:{' '}
                        <strong className="font-mono text-amber-400">
                          {so.shipment.trackingNumber || so.shipment.waybillNumber}
                        </strong>
                      </span>
                    ) : (
                      <span className="text-stone-500 italic">No shipment booked yet</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-stone-400">
                      Commission: {formatPrice(so.commissionFeeMinor)}
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      Artisan Net: {formatPrice(so.netArtisanPayableMinor)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Right Column: Customer & Payment Intelligence (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Customer & Shipping Address */}
            <Card className="bg-stone-900 border-stone-800 p-5 space-y-4 text-white">
              <h3 className="text-sm font-bold border-b border-stone-800 pb-2">
                Customer & Shipping Information
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-stone-400 block text-[11px]">Customer Name:</span>
                  <span className="font-semibold text-stone-200">{order.customerName}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Email:</span>
                  <span className="font-mono text-stone-300">{order.customerEmail}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Placed At:</span>
                  <span className="text-stone-300">
                    {new Date(order.createdAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-800 space-y-1 text-xs">
                <span className="text-stone-400 block text-[11px] font-semibold uppercase">
                  Delivery Destination
                </span>
                <div className="text-stone-200 font-medium">
                  {order.shippingAddress.recipientName}
                </div>
                <div className="text-stone-400">{order.shippingAddress.addressLine1}</div>
                {order.shippingAddress.addressLine2 && (
                  <div className="text-stone-400">{order.shippingAddress.addressLine2}</div>
                )}
                <div className="text-stone-400">
                  {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
                  {order.shippingAddress.postalCode}
                </div>
                <div className="text-stone-400">{order.shippingAddress.country}</div>
              </div>
            </Card>

            {/* Authoritative Gateway Payment */}
            <Card className="bg-stone-900 border-stone-800 p-5 space-y-4 text-white">
              <h3 className="text-sm font-bold border-b border-stone-800 pb-2">
                Authoritative Gateway Record
              </h3>

              {order.payment ? (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-stone-400">Gateway Provider:</span>
                    <Badge variant="default" size="sm">
                      {order.payment.provider}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Gateway Status:</span>
                    <Badge variant="success" size="sm">
                      {order.payment.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-400">Captured Minor:</span>
                    <span className="font-bold text-amber-400">
                      {formatPrice(order.payment.amountMinor)}
                    </span>
                  </div>
                  <div className="flex flex-col pt-1 border-t border-stone-800/60">
                    <span className="text-stone-400 text-[10px]">
                      Provider Intent / Transaction ID:
                    </span>
                    <span className="font-mono text-stone-300 text-[11px] break-all">
                      {order.payment.providerOrderId}
                    </span>
                  </div>
                  {order.payment.capturedAt && (
                    <div className="flex justify-between pt-1 border-t border-stone-800/60">
                      <span className="text-stone-400">Captured At:</span>
                      <span className="text-stone-300 font-mono text-[11px]">
                        {new Date(order.payment.capturedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic">
                  No authoritative gateway capture record on file.
                </p>
              )}
            </Card>

            {/* Order Total Minor Summary */}
            <Card className="bg-stone-950 border border-stone-800 p-5 text-white">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-stone-300">Transaction Grand Total:</span>
                <span className="text-xl font-bold text-amber-400">
                  {formatPrice(order.totalAmountMinor)}
                </span>
              </div>
            </Card>
          </div>
        </div>
      )}
    </main>
  );
}
