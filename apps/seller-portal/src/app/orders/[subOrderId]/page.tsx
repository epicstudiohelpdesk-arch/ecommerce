'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, Badge, Button, LoadingSpinner, Alert, Modal, Textarea } from '@repo/ui';
import { formatCurrency } from '@repo/shared';
import { getSellerOrderDetail, updateSubOrderStatus } from '../../../lib/api';
import type { SellerSubOrderDetailDto } from '@repo/api-contracts';

function getStatusBadge(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return <Badge variant="warning">Confirmed • Awaiting Production</Badge>;
    case 'IN_PRODUCTION':
      return <Badge variant="default">In Production • Crafting</Badge>;
    case 'READY_FOR_PICKUP':
      return <Badge variant="success">Ready for Courier Pickup</Badge>;
    case 'SHIPPED':
      return <Badge variant="default">Shipped • In Transit</Badge>;
    case 'DELIVERED':
    case 'COMPLETED':
      return <Badge variant="success">Completed</Badge>;
    case 'CANCELLED':
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export default function SellerOrderDetailPage() {
  const params = useParams();
  const subOrderId = typeof params['subOrderId'] === 'string' ? params['subOrderId'] : '';

  const [order, setOrder] = useState<SellerSubOrderDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Cancellation Modal state
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!subOrderId) return;
    let isMounted = true;
    setLoading(true);
    getSellerOrderDetail(subOrderId)
      .then((data) => {
        if (isMounted) {
          setOrder(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [subOrderId]);

  const handleTransition = async (
    targetStatus: 'IN_PRODUCTION' | 'READY_FOR_PICKUP' | 'CANCELLED',
    reason?: string,
  ) => {
    if (!order) return;
    try {
      setUpdating(true);
      setActionError(null);
      const updated = await updateSubOrderStatus(order.id, {
        status: targetStatus,
        cancellationReason: reason,
        notes: reason || `Updated to ${targetStatus} by artisan`,
      });
      setOrder(updated);
      setCancelModalOpen(false);
      setCancelReason('');
    } catch {
      setActionError('Failed to update order status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-stone-900">Sub-Order Not Found</h2>
        <Link href="/orders" className="text-amber-800 underline mt-4 inline-block">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  const hasCustomizations = order.items.some((i) => !!i.customizationInput);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Navigation Breadcrumb / Back Link */}
      <div>
        <Link
          href="/orders"
          className="text-xs font-semibold text-stone-500 hover:text-stone-900 flex items-center gap-1.5"
        >
          <span>←</span> Back to All Orders
        </Link>
      </div>

      {actionError && (
        <Alert variant="error" className="text-xs">
          {actionError}
        </Alert>
      )}

      {/* Header Info & Workflow State Action */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-serif font-bold text-stone-900">{order.subOrderNumber}</h1>
            {getStatusBadge(order.status)}
          </div>
          <div className="flex items-center gap-4 text-xs text-stone-500 mt-1">
            <span>
              Parent Order: <strong className="text-stone-700">{order.parentOrderNumber}</strong>
            </span>
            <span>•</span>
            <span>Placed: {new Date(order.createdAt).toLocaleString('en-IN')}</span>
            <span>•</span>
            <span>
              Payment: <strong className="text-emerald-700">{order.parentPaymentStatus}</strong>
            </span>
          </div>
        </div>

        {/* Action Controls for Permitted Transitions */}
        <div className="flex items-center gap-3">
          {order.status === 'CONFIRMED' && (
            <>
              <Button
                variant="primary"
                onClick={() => handleTransition('IN_PRODUCTION')}
                disabled={updating}
              >
                {updating ? 'Updating...' : 'Start Production'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCancelModalOpen(true)}
                disabled={updating}
              >
                Cancel Order
              </Button>
            </>
          )}

          {order.status === 'IN_PRODUCTION' && (
            <>
              <Button
                variant="primary"
                onClick={() => handleTransition('READY_FOR_PICKUP')}
                disabled={updating}
              >
                {updating ? 'Updating...' : 'Mark Ready for Pickup'}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setCancelModalOpen(true)}
                disabled={updating}
              >
                Cancel Order
              </Button>
            </>
          )}

          {order.status === 'READY_FOR_PICKUP' && (
            <div className="text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <span>✓</span> Package ready. Awaiting courier allocation in Gate G11.
            </div>
          )}

          {order.status === 'CANCELLED' && (
            <Badge variant="destructive">This sub-order was cancelled</Badge>
          )}
        </div>
      </div>

      {/* Special Buyer Customisation Callout */}
      {hasCustomizations && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎨</span>
            <h2 className="text-sm font-bold text-amber-900">
              Special Artisan Customisation Instructions
            </h2>
          </div>
          <p className="text-xs text-amber-800">
            The customer provided custom notes for this handmade creation. Please review carefully
            before beginning production:
          </p>
          <div className="mt-2 space-y-1">
            {order.items
              .filter((i) => !!i.customizationInput)
              .map((i) => (
                <div
                  key={i.id}
                  className="bg-white p-3 rounded-lg border border-amber-200 text-xs text-stone-800"
                >
                  <strong className="text-amber-900">{i.titleSnapshot}:</strong>{' '}
                  <span className="italic">"{i.customizationInput}"</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Line Items List Card */}
      <Card className="p-6 space-y-4">
        <h2 className="text-base font-bold text-stone-900 font-serif">
          Ordered Craft Items ({order.items.length})
        </h2>

        <div className="divide-y divide-stone-100">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-stone-900">{item.titleSnapshot}</h3>
                <div className="text-xs text-stone-500 flex items-center gap-3">
                  <span>
                    SKU: <span className="font-mono">{item.skuSnapshot}</span>
                  </span>
                </div>
              </div>

              <div className="text-right sm:min-w-36">
                <div className="text-xs text-stone-500">
                  {item.quantity} × {formatCurrency(item.unitPriceMinor, 'INR', 'en-IN')}
                </div>
                <div className="text-sm font-bold text-stone-900">
                  {formatCurrency(item.totalPriceMinor, 'INR', 'en-IN')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Financials & Delivery 2-Column Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Financial Breakdown Card */}
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
            Sub-Order Financial Settlement
          </h2>
          <div className="divide-y divide-stone-100 text-xs">
            <div className="py-2 flex justify-between text-stone-600">
              <span>Item Subtotal:</span>
              <span className="font-medium">
                {formatCurrency(order.itemSubtotalMinor, 'INR', 'en-IN')}
              </span>
            </div>
            <div className="py-2 flex justify-between text-stone-600">
              <span>Shipping Allowance:</span>
              <span className="font-medium">
                {formatCurrency(order.shippingFeeMinor, 'INR', 'en-IN')}
              </span>
            </div>
            <div className="py-2 flex justify-between text-rose-700">
              <span>Platform Craft Commission (Deducted):</span>
              <span className="font-medium">
                -{formatCurrency(order.commissionFeeMinor, 'INR', 'en-IN')}
              </span>
            </div>
            <div className="py-3 flex justify-between text-sm font-bold text-emerald-800">
              <span>Net Artisan Payable:</span>
              <span>{formatCurrency(order.netSellerPayableMinor, 'INR', 'en-IN')}</span>
            </div>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            Net payable is credited to delivery escrow upon payment capture and disbursed upon
            successful order completion.
          </p>
        </Card>

        {/* Privacy-Protected Shipping Destination */}
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
            Delivery Destination (Privacy Redacted)
          </h2>
          <div className="text-xs text-stone-600 space-y-1">
            <p>
              City:{' '}
              <strong className="text-stone-900">
                {order.shippingAddress?.city || 'Standard Delivery'}
              </strong>
            </p>
            <p>
              State / Region:{' '}
              <strong className="text-stone-900">{order.shippingAddress?.state || 'India'}</strong>
            </p>
            <p>
              Postal Code:{' '}
              <strong className="text-stone-900">
                {order.shippingAddress?.postalCode || 'Verified'}
              </strong>
            </p>
          </div>
          <p className="text-[11px] text-stone-400 border-t border-stone-100 pt-3">
            🔒 In compliance with marketplace multi-tenant privacy policies, recipient phone and
            street details are generated directly onto courier labels in Gate G11.
          </p>
        </Card>
      </div>

      {/* Order Fulfillment Timeline */}
      <Card className="p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
          Order Fulfillment History & Timeline
        </h2>
        <div className="space-y-3">
          {order.timeline.map((event, idx) => (
            <div key={event.id || idx} className="flex items-start gap-3 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 mt-1 shrink-0" />
              <div>
                <span className="font-bold text-stone-900">{event.toStatus}:</span>{' '}
                <span className="text-stone-700">{event.notes}</span>
                <span className="block text-[11px] text-stone-400 mt-0.5">
                  {new Date(event.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Cancellation Dialog Modal */}
      {cancelModalOpen && (
        <Modal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          title="Cancel Sub-Order"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Please provide a valid reason for cancelling this order. The customer will be informed
              and full payment refunded.
            </p>
            <Textarea
              placeholder="e.g. Clay batch damaged during kiln firing; unable to complete custom order within deadline."
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
                Go Back
              </Button>
              <Button
                variant="destructive"
                disabled={cancelReason.trim().length < 3 || updating}
                onClick={() => handleTransition('CANCELLED', cancelReason.trim())}
              >
                {updating ? 'Cancelling...' : 'Confirm Cancellation'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
