'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button, Badge, Card } from '@repo/ui';
import type { AdminShipmentListItemDto, AdminShipmentDetailDto } from '@repo/api-contracts';
import type { AdminShipmentQuery } from '@repo/validation';
import { getAdminShipments, getAdminShipmentDetail } from '../../lib/api';

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<AdminShipmentListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [hasException, setHasException] = useState(false);
  const [page, setPage] = useState(1);
  const [totalShipments, setTotalShipments] = useState(0);

  // Inspector modal state
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminShipmentDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadShipments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAdminShipments({
        search: searchQuery.trim() || undefined,
        carrier: carrierFilter === 'ALL' ? undefined : carrierFilter,
        status: statusFilter === 'ALL' ? undefined : (statusFilter as AdminShipmentQuery['status']),
        hasException: hasException ? true : undefined,
        page,
        limit: 20,
      });
      setShipments(res.items);
      setTotalShipments(res.meta.total);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to query marketplace shipments');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, carrierFilter, statusFilter, hasException, page]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  const handleInspect = async (id: string) => {
    setSelectedShipmentId(id);
    try {
      setDetailLoading(true);
      const res = await getAdminShipmentDetail(id);
      setDetail(res);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge variant="success">DELIVERED</Badge>;
      case 'IN_TRANSIT':
      case 'OUT_FOR_DELIVERY':
        return <Badge variant="warning">{status.replace('_', ' ')}</Badge>;
      case 'DELIVERY_FAILED':
      case 'CANCELLED':
      case 'RTO_INITIATED':
      case 'RTO_DELIVERED':
        return <Badge variant="destructive">{status.replace('_', ' ')}</Badge>;
      default:
        return <Badge variant="default">{status.replace('_', ' ')}</Badge>;
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
              Courier Oversight & Fulfilment
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              Multi-carrier tracking, milestone event auditing, delivery exception intervention, and
              artisan pickup status.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => loadShipments()} disabled={loading}>
            {loading ? 'Refreshing...' : '↻ Refresh Shipments'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="bg-rose-950/40 border-rose-800 text-rose-200 p-4">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️</span> Fulfilment Telemetry Warning
          </div>
          <p className="text-sm mt-1 text-rose-300">{error}</p>
        </Card>
      )}

      {/* Filters */}
      <Card className="bg-stone-900 border-stone-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">
              Search Shipments
            </label>
            <input
              type="text"
              placeholder="Waybill, tracking #, seller, shop, city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">Courier Carrier</label>
            <select
              value={carrierFilter}
              onChange={(e) => {
                setCarrierFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Carriers</option>
              <option value="DELHIVERY">Delhivery</option>
              <option value="SHIPROCKET">Shiprocket</option>
              <option value="BLUEDART">BlueDart</option>
              <option value="MOCK_COURIER">Mock Carrier</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-400 mb-1">
              Fulfilment Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-stone-950 border border-stone-800 rounded text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="LABEL_CREATED">Label Created</option>
              <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="DELIVERY_FAILED">Delivery Failed</option>
              <option value="RTO_INITIATED">RTO Initiated</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <button
              onClick={() => {
                setHasException(!hasException);
                setPage(1);
              }}
              className={`w-full px-3 py-2 rounded text-xs font-semibold transition-colors border ${
                hasException
                  ? 'bg-rose-900/60 border-rose-700 text-rose-200'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-white'
              }`}
            >
              {hasException ? '⚠️ Only Exceptions Active' : 'Filter Exceptions Only'}
            </button>
          </div>
        </div>
      </Card>

      {/* Main Table */}
      <Card className="bg-stone-900 border-stone-800 overflow-hidden">
        <div className="p-4 border-b border-stone-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            Active Fulfilment Consignments ({totalShipments})
          </h2>
          <span className="text-xs text-stone-400">Page {page}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-stone-400 text-xs">
            Querying courier shipments from database...
          </div>
        ) : shipments.length === 0 ? (
          <div className="p-12 text-center text-stone-500 text-xs">
            No shipments found for given filter parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                <tr>
                  <th className="py-3 px-4">Waybill / Tracking</th>
                  <th className="py-3 px-4">Carrier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sub-Order #</th>
                  <th className="py-3 px-4">Artisan Seller</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Pickup Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-amber-400">
                        {s.waybillNumber || s.trackingNumber}
                      </div>
                      <div className="text-[11px] text-stone-500">Trk: {s.trackingNumber}</div>
                    </td>
                    <td className="py-3 px-4 font-sans font-semibold text-white">{s.carrier}</td>
                    <td className="py-3 px-4 font-sans">{getStatusBadge(s.status)}</td>
                    <td className="py-3 px-4 font-sans text-stone-300">{s.subOrderNumber}</td>
                    <td className="py-3 px-4 font-sans">
                      <div className="text-stone-200">{s.shopName}</div>
                      <div className="text-stone-500 text-[11px]">{s.sellerName}</div>
                    </td>
                    <td className="py-3 px-4 font-sans text-stone-300">
                      {s.destinationCity} ({s.destinationPincode})
                    </td>
                    <td className="py-3 px-4 text-stone-400 whitespace-nowrap text-[11px]">
                      {s.pickupDate ? new Date(s.pickupDate).toLocaleDateString() : 'Pending'}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <Button variant="secondary" size="sm" onClick={() => handleInspect(s.id)}>
                        Milestones &rarr;
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail / Milestone Inspector Drawer */}
      {selectedShipmentId && (
        <div className="fixed inset-0 z-50 bg-black/75 flex justify-end">
          <div className="w-full max-w-xl bg-stone-900 border-l border-stone-800 h-full p-6 overflow-y-auto space-y-6 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div>
                <h3 className="text-base font-bold">Consignment Telemetry & Milestones</h3>
                <p className="text-xs text-stone-400 font-mono">ID: {selectedShipmentId}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedShipmentId(null);
                  setDetail(null);
                }}
                className="text-stone-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="py-16 text-center text-stone-400 text-xs">
                Querying carrier milestone events...
              </div>
            ) : detail ? (
              <div className="space-y-6">
                {/* Consignment Specs */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-stone-950 p-4 rounded-lg border border-stone-800">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase">Carrier</span>
                    <span className="font-semibold text-white">{detail.carrier}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase">Status</span>
                    {getStatusBadge(detail.status)}
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase">
                      Package Weight
                    </span>
                    <span className="font-mono text-stone-300">{detail.packageWeightGrams} g</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase">
                      Dimensions (L&times;W&times;H)
                    </span>
                    <span className="font-mono text-stone-300">
                      {detail.dimensions.lengthCm}&times;{detail.dimensions.widthCm}&times;
                      {detail.dimensions.heightCm} cm
                    </span>
                  </div>
                </div>

                {/* Exception Banner */}
                {detail.cancellationReason && (
                  <div className="bg-rose-950/60 border border-rose-800 text-rose-200 p-3 rounded text-xs">
                    <strong className="block text-[11px] uppercase font-semibold">
                      Delivery Exception Reason:
                    </strong>
                    {detail.cancellationReason}
                  </div>
                )}

                {/* Milestone History Timeline */}
                <div>
                  <h4 className="text-xs uppercase font-semibold text-stone-400 tracking-wider mb-4">
                    Chronological Carrier Checkpoints ({detail.trackingEvents.length})
                  </h4>

                  {detail.trackingEvents.length === 0 ? (
                    <p className="text-xs text-stone-500 italic">
                      No carrier tracking checkpoints emitted yet.
                    </p>
                  ) : (
                    <div className="relative border-l-2 border-stone-800 pl-4 space-y-6 ml-2">
                      {detail.trackingEvents.map((evt, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-stone-900" />
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-bold text-white font-sans">
                              {evt.status.replace('_', ' ')}
                            </span>
                            <span className="text-[11px] text-stone-400 font-mono">
                              {new Date(evt.timestamp).toLocaleString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                              })}
                            </span>
                          </div>
                          {evt.location && (
                            <div className="text-[11px] text-amber-400 mt-0.5 font-sans">
                              📍 {evt.location}
                            </div>
                          )}
                          <p className="text-xs text-stone-300 mt-1 font-sans">{evt.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500">Failed to load consignment detail.</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
