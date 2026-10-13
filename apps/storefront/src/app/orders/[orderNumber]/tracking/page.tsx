'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchCustomerTracking } from '../../../../lib/api';
import type { CustomerTrackingResponseDto } from '@repo/api-contracts';

export default function CustomerOrderTrackingPage() {
  const params = useParams();
  const orderNumber = typeof params['orderNumber'] === 'string' ? params['orderNumber'] : '';

  const [trackingData, setTrackingData] = useState<CustomerTrackingResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    setLoading(true);
    fetchCustomerTracking(orderNumber)
      .then((res) => {
        if (res.success && res.data) {
          setTrackingData(res.data);
        } else {
          setError('Order tracking information could not be retrieved.');
        }
      })
      .catch(() => {
        setError('Network error while fetching order tracking details.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderNumber]);

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-stone-600 text-sm font-serif">Locating your artisanal shipments...</p>
      </main>
    );
  }

  if (error || !trackingData) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-full flex items-center justify-center text-2xl mx-auto">
          📦
        </div>
        <h1 className="text-2xl font-serif font-bold text-stone-900">Tracking Unavailable</h1>
        <p className="text-stone-600 text-sm max-w-md mx-auto">
          {error || 'No active shipments were found for order ' + orderNumber + '.'}
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors"
        >
          ← Return to Marketplace Home
        </Link>
      </main>
    );
  }

  const { shipments, customerOrderState } = trackingData;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      {/* Header Breadcrumbs */}
      <div>
        <Link
          href="/"
          className="text-xs font-semibold text-stone-500 hover:text-stone-900 flex items-center gap-1.5"
        >
          <span>←</span> Back to Marketplace Home
        </Link>
      </div>

      {/* Main Status Header Card */}
      <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-stone-100 pb-5">
          <div>
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
              Fulfilment Tracking
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900">
              Order {orderNumber}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">Order Status:</span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
              {customerOrderState}
            </span>
          </div>
        </div>

        {/* Global Journey Visual Stepper */}
        <div className="py-4">
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto text-sm font-bold">
                ✓
              </div>
              <span className="font-bold text-stone-900 block">Placed</span>
              <span className="text-[10px] text-stone-500">Payment Verified</span>
            </div>
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto text-sm font-bold">
                ✓
              </div>
              <span className="font-bold text-stone-900 block">Handcrafted</span>
              <span className="text-[10px] text-stone-500">Artisan Workshop</span>
            </div>
            <div className="space-y-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${
                  shipments.length > 0 && shipments.some((s) => s.status !== 'LABEL_CREATED')
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                🚚
              </div>
              <span className="font-bold text-stone-900 block">In Transit</span>
              <span className="text-[10px] text-stone-500">Express Courier</span>
            </div>
            <div className="space-y-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-bold ${
                  customerOrderState === 'COMPLETED' || customerOrderState === 'DELIVERED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 text-stone-400'
                }`}
              >
                🏠
              </div>
              <span className="font-bold text-stone-900 block">Delivered</span>
              <span className="text-[10px] text-stone-500">At Destination</span>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Vendor Artisanal Shipments Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-serif font-bold text-stone-900">
          Artisan Packages ({shipments.length})
        </h2>

        {shipments.length === 0 ? (
          <div className="p-8 rounded-3xl bg-amber-50/50 border border-amber-200/80 text-center space-y-3">
            <span className="text-3xl block">🎨</span>
            <h3 className="text-base font-serif font-bold text-stone-900">
              Packages are being crafted & prepared
            </h3>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              Our independent artisans are currently carving, glazing, or tailoring your handmade
              items. Tracking numbers and courier milestones will activate here as soon as packages
              are handed over to our logistics network.
            </p>
          </div>
        ) : (
          shipments.map((shipment) => (
            <div
              key={shipment.subOrderId}
              className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 shadow-sm space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                    <span>{shipment.sellerShopName}</span>
                    <span className="text-xs font-normal text-stone-500">
                      • Carrier: {shipment.carrierName}
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-1">
                    AWB / Tracking Number:{' '}
                    <strong className="font-mono text-stone-800">{shipment.trackingNumber}</strong>
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-800 border border-stone-200">
                    {shipment.status}
                  </span>
                  {shipment.estimatedDeliveryDate && (
                    <p className="text-[11px] text-stone-500 mt-1">
                      Est. Delivery:{' '}
                      {new Date(shipment.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Milestones Checkpoint List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Carrier Tracking Milestones
                </h4>
                {shipment.checkpoints.length === 0 ? (
                  <p className="text-xs text-stone-500 italic">
                    Awaiting initial carrier pickup scan.
                  </p>
                ) : (
                  <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5 before:bg-stone-200">
                    {shipment.checkpoints.map((cp, idx) => (
                      <div key={idx} className="flex items-start gap-4 text-xs relative pl-6">
                        <span className="absolute left-1 top-1 w-2.5 h-2.5 rounded-full bg-amber-600 ring-4 ring-white" />
                        <div className="flex-1">
                          <div className="flex justify-between items-baseline">
                            <span className="font-bold text-stone-900">{cp.status}</span>
                            <span className="text-[11px] text-stone-400">
                              {new Date(cp.timestamp).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-stone-600 mt-0.5">{cp.description}</p>
                          {cp.location && (
                            <span className="text-[11px] text-stone-500 block">
                              Location: {cp.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
