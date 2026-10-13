'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Card,
  Badge,
  Button,
  LoadingSpinner,
  Alert,
  Modal,
  Textarea,
  Input,
  Select,
} from '@repo/ui';
import { formatCurrency } from '@repo/shared';
import {
  getSellerOrderDetail,
  updateSubOrderStatus,
  getShipmentDetails,
  bookCourierShipment,
  getShippingLabel,
  scheduleCourierPickup,
  cancelCourierShipment,
} from '../../../lib/api';
import type { SellerSubOrderDetailDto, ShipmentDto, ShippingLabelDto } from '@repo/api-contracts';

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

function getShipmentStatusBadge(status: string) {
  switch (status) {
    case 'LABEL_CREATED':
      return <Badge variant="warning">Shipping Label Generated</Badge>;
    case 'PICKUP_SCHEDULED':
      return <Badge variant="default">Courier Pickup Scheduled</Badge>;
    case 'IN_TRANSIT':
      return <Badge variant="default">In Transit • With Courier</Badge>;
    case 'OUT_FOR_DELIVERY':
      return <Badge variant="default">Out for Delivery</Badge>;
    case 'DELIVERED':
      return <Badge variant="success">Delivered to Customer</Badge>;
    case 'DELIVERY_FAILED':
      return <Badge variant="destructive">Delivery Exception</Badge>;
    case 'CANCELLED':
      return <Badge variant="destructive">Shipment Cancelled</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export default function SellerOrderDetailPage() {
  const params = useParams();
  const subOrderId = typeof params['subOrderId'] === 'string' ? params['subOrderId'] : '';

  const [order, setOrder] = useState<SellerSubOrderDetailDto | null>(null);
  const [shipment, setShipment] = useState<ShipmentDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Cancellation Modal state (for Sub-Order)
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Booking Modal State (Gate G11)
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [packageWeight, setPackageWeight] = useState(650);
  const [pkgLength, setPkgLength] = useState(220);
  const [pkgWidth, setPkgWidth] = useState(160);
  const [pkgHeight, setPkgHeight] = useState(120);
  const [carrierCode, setCarrierCode] = useState<'DELHIVERY' | 'MOCK_COURIER' | 'SHIPROCKET'>(
    'DELHIVERY',
  );
  const [pickupDate, setPickupDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]!,
  );
  const [bookingNotes, setBookingNotes] = useState('');

  // Label Modal State
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);
  const [labelData, setLabelData] = useState<ShippingLabelDto | null>(null);

  // Pickup Schedule Modal State
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupSlot, setPickupSlot] = useState('10:00 - 13:00');

  // Cancel Shipment Modal State
  const [cancelShipmentModalOpen, setCancelShipmentModalOpen] = useState(false);
  const [cancellingShipment, setCancellingShipment] = useState(false);
  const [cancelShipmentReason, setCancelShipmentReason] = useState('');

  const loadData = async () => {
    if (!subOrderId) return;
    try {
      const orderData = await getSellerOrderDetail(subOrderId);
      setOrder(orderData);
      const shipmentData = await getShipmentDetails(subOrderId);
      setShipment(shipmentData);
    } catch {
      // error handled in state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subOrderId]);

  const handleTransition = async (
    targetStatus: 'IN_PRODUCTION' | 'READY_FOR_PICKUP' | 'CANCELLED',
    reason?: string,
  ) => {
    if (!order) return;
    try {
      setUpdating(true);
      setActionError(null);
      setActionSuccess(null);
      const updated = await updateSubOrderStatus(order.id, {
        status: targetStatus,
        cancellationReason: reason,
        notes: reason || `Updated to ${targetStatus} by artisan`,
      });
      setOrder(updated);
      setCancelModalOpen(false);
      setCancelReason('');
      setActionSuccess(`Order updated to ${targetStatus}`);
    } catch {
      setActionError('Failed to update order status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleBookShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    try {
      setBookingLoading(true);
      setActionError(null);
      setActionSuccess(null);
      await bookCourierShipment(order.id, {
        packageWeightGrams: packageWeight,
        packageDimensionsMm: {
          length: pkgLength,
          width: pkgWidth,
          height: pkgHeight,
        },
        pickupDate,
        carrierCode,
        notes: bookingNotes,
      });

      setBookModalOpen(false);
      setActionSuccess('Courier shipment successfully booked and waybill generated.');
      await loadData();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to book courier shipment. Please try again.';
      setActionError(msg);
    } finally {
      setBookingLoading(false);
    }
  };

  const handleViewLabel = async () => {
    if (!order) return;
    try {
      setLabelLoading(true);
      const label = await getShippingLabel(order.id);
      setLabelData(label);
      setLabelModalOpen(true);
    } catch {
      setActionError('Unable to generate shipping label preview.');
    } finally {
      setLabelLoading(false);
    }
  };

  const handleSchedulePickup = async () => {
    if (!order) return;
    try {
      setPickupLoading(true);
      setActionError(null);
      await scheduleCourierPickup(order.id, {
        pickupDate,
        timeSlot: pickupSlot,
      });
      setPickupModalOpen(false);
      setActionSuccess('Courier pickup slot successfully confirmed.');
      await loadData();
    } catch {
      setActionError('Failed to schedule courier pickup.');
    } finally {
      setPickupLoading(false);
    }
  };

  const handleCancelShipment = async () => {
    if (!order) return;
    try {
      setCancellingShipment(true);
      setActionError(null);
      await cancelCourierShipment(order.id, {
        reason: cancelShipmentReason,
      });
      setCancelShipmentModalOpen(false);
      setCancelShipmentReason('');
      setActionSuccess('Shipment cancelled with courier.');
      await loadData();
    } catch {
      setActionError('Failed to cancel shipment.');
    } finally {
      setCancellingShipment(false);
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
  const isShipmentActive = shipment && shipment.status !== 'CANCELLED';

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

      {actionSuccess && (
        <Alert variant="success" className="text-xs">
          {actionSuccess}
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

          {order.status === 'READY_FOR_PICKUP' && !isShipmentActive && (
            <Button
              variant="primary"
              onClick={() => setBookModalOpen(true)}
              disabled={bookingLoading}
            >
              📦 Book Courier Fulfilment
            </Button>
          )}

          {isShipmentActive && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleViewLabel}
                disabled={labelLoading}
              >
                📄 Print Label
              </Button>
              {shipment.status === 'LABEL_CREATED' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setPickupModalOpen(true)}
                  disabled={pickupLoading}
                >
                  🚚 Schedule Pickup
                </Button>
              )}
              {(shipment.status === 'LABEL_CREATED' || shipment.status === 'PICKUP_SCHEDULED') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCancelShipmentModalOpen(true)}
                >
                  Cancel Shipment
                </Button>
              )}
            </div>
          )}

          {order.status === 'CANCELLED' && (
            <Badge variant="destructive">This sub-order was cancelled</Badge>
          )}
        </div>
      </div>

      {/* Gate G11 Fulfilment Information Card (When Booked) */}
      {isShipmentActive && (
        <Card className="p-6 border-l-4 border-l-amber-600 bg-amber-50/20 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🚚</span>
                <h2 className="text-base font-bold text-stone-900 font-serif">
                  Fulfilment & Logistics Details
                </h2>
                {getShipmentStatusBadge(shipment.status)}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Carrier: <strong>{shipment.carrierCode} Express Logistics</strong> • Scheduled
                Pickup:{' '}
                <strong>
                  {shipment.pickupDate ? shipment.pickupDate.split('T')[0] : 'Pending'}
                </strong>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-stone-500">AWB / Waybill:</span>
              <span className="font-mono font-bold bg-stone-100 text-stone-800 px-2 py-1 rounded border border-stone-200 select-all">
                {shipment.waybillNumber || shipment.trackingNumber}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-amber-200/50 text-xs">
            <div>
              <span className="text-stone-500 block">Package Dead Weight</span>
              <strong className="text-stone-800">{shipment.packageWeightGrams} grams</strong>
            </div>
            <div>
              <span className="text-stone-500 block">Package Dimensions</span>
              <strong className="text-stone-800">
                {shipment.packageDimensionsMm.length} × {shipment.packageDimensionsMm.width} ×{' '}
                {shipment.packageDimensionsMm.height} mm
              </strong>
            </div>
            <div>
              <span className="text-stone-500 block">Carrier Service Type</span>
              <strong className="text-stone-800">Pre-paid Surface Express</strong>
            </div>
          </div>

          {/* Courier Milestones Checkpoints */}
          {shipment.milestones && shipment.milestones.length > 0 && (
            <div className="mt-4 pt-4 border-t border-amber-200/50 space-y-2">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Live Courier Checkpoints
              </h3>
              <div className="space-y-2">
                {shipment.milestones.map((ms) => (
                  <div key={ms.id} className="flex items-start gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 mt-1 shrink-0" />
                    <div>
                      <span className="font-semibold text-stone-800">{ms.status}:</span>{' '}
                      <span className="text-stone-600">{ms.description}</span>
                      {ms.location && <span className="text-stone-400"> ({ms.location})</span>}
                      <span className="block text-[10px] text-stone-400">
                        {new Date(ms.eventTime).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

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
            before packaging:
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
                <div className="text-sm font-bold text-stone-900 mt-0.5">
                  {formatCurrency(item.totalPriceMinor, 'INR', 'en-IN')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Financials & Delivery Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Financial Calculation Breakdown */}
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
            Artisan Payout Breakdown
          </h2>
          <div className="space-y-2 text-xs divide-y divide-stone-100">
            <div className="flex justify-between pt-1">
              <span className="text-stone-500">Item Craft Subtotal</span>
              <span className="font-medium text-stone-800">
                {formatCurrency(order.itemSubtotalMinor, 'INR', 'en-IN')}
              </span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-stone-500">Shipping Contribution</span>
              <span className="font-medium text-stone-800">
                +{formatCurrency(order.shippingFeeMinor, 'INR', 'en-IN')}
              </span>
            </div>
            <div className="flex justify-between pt-2 text-amber-900">
              <span>Platform Commission (10%)</span>
              <span>-{formatCurrency(order.commissionFeeMinor, 'INR', 'en-IN')}</span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-bold text-stone-900">
              <span>Net Artisan Payable</span>
              <span className="text-emerald-700">
                {formatCurrency(order.netSellerPayableMinor, 'INR', 'en-IN')}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-stone-400 pt-2 border-t border-stone-100">
            Funds remain securely in marketplace escrow until courier delivery confirmation.
          </p>
        </Card>

        {/* Customer Shipping Address Card */}
        <Card className="p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
            Delivery Destination
          </h2>
          <div className="text-xs text-stone-600 space-y-1">
            <p>
              Recipient:{' '}
              <strong className="text-stone-900">
                {order.shippingAddress?.recipientName || 'Customer'}
              </strong>
            </p>
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
            full street address are printed directly onto authorized courier shipping labels.
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

      {/* Book Shipment Modal (Gate G11) */}
      {bookModalOpen && (
        <Modal
          isOpen={bookModalOpen}
          onClose={() => setBookModalOpen(false)}
          title="Book Courier Shipment"
        >
          <form onSubmit={handleBookShipment} className="space-y-4 text-xs">
            <p className="text-stone-600">
              Provide package weight and parcel dimensions to generate official courier waybill and
              printable label.
            </p>

            <div className="space-y-1">
              <label className="font-bold text-stone-700">Logistics Carrier Provider</label>
              <Select
                value={carrierCode}
                onChange={(e) =>
                  setCarrierCode(e.target.value as 'DELHIVERY' | 'MOCK_COURIER' | 'SHIPROCKET')
                }
              >
                <option value="DELHIVERY">Delhivery B2C Surface Express (India)</option>
                <option value="SHIPROCKET">Shiprocket Multi-Carrier Network</option>
                <option value="MOCK_COURIER">Mock Logistics (Local Dev / CI)</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-stone-700">Dead Weight (Grams)</label>
                <Input
                  type="number"
                  min={50}
                  max={50000}
                  value={packageWeight}
                  onChange={(e) => setPackageWeight(parseInt(e.target.value, 10) || 500)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-stone-700">Pickup Date</label>
                <Input
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-stone-700">Dimensions (L × W × H in mm)</label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  placeholder="Length"
                  value={pkgLength}
                  onChange={(e) => setPkgLength(parseInt(e.target.value, 10) || 200)}
                  required
                />
                <Input
                  type="number"
                  placeholder="Width"
                  value={pkgWidth}
                  onChange={(e) => setPkgWidth(parseInt(e.target.value, 10) || 150)}
                  required
                />
                <Input
                  type="number"
                  placeholder="Height"
                  value={pkgHeight}
                  onChange={(e) => setPkgHeight(parseInt(e.target.value, 10) || 100)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-stone-700">Handling Notes (Optional)</label>
              <Input
                type="text"
                placeholder="Fragile handcrafted ceramics; keep upright."
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
              <Button variant="ghost" onClick={() => setBookModalOpen(false)} type="button">
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={bookingLoading}>
                {bookingLoading ? 'Booking Waybill...' : 'Confirm & Book Shipment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Label Preview Modal */}
      {labelModalOpen && labelData && (
        <Modal
          isOpen={labelModalOpen}
          onClose={() => setLabelModalOpen(false)}
          title={`Shipping Label • ${labelData.waybillNumber}`}
        >
          <div className="space-y-4 text-xs">
            <div className="border border-stone-300 rounded p-2 bg-stone-50 max-h-96 overflow-y-auto">
              {labelData.contentHtml ? (
                <div dangerouslySetInnerHTML={{ __html: labelData.contentHtml }} />
              ) : (
                <div className="p-4 text-center">Label URL: {labelData.labelUrl}</div>
              )}
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-stone-500">
                Print on 4x6" thermal label paper or standard A4 sheet.
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setLabelModalOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" onClick={() => window.print()}>
                  Print Now
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Pickup Schedule Modal */}
      {pickupModalOpen && (
        <Modal
          isOpen={pickupModalOpen}
          onClose={() => setPickupModalOpen(false)}
          title="Schedule Courier Pickup Slot"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Select a preferred arrival window for the logistics courier pickup agent at your
              workshop.
            </p>
            <div className="space-y-1">
              <label className="font-bold text-stone-700">Preferred Pickup Date</label>
              <Input
                type="date"
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-stone-700">Pickup Time Window</label>
              <Select value={pickupSlot} onChange={(e) => setPickupSlot(e.target.value)}>
                <option value="10:00 - 13:00">Morning Slot (10:00 AM - 1:00 PM)</option>
                <option value="14:00 - 17:00">Afternoon Slot (2:00 PM - 5:00 PM)</option>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
              <Button variant="ghost" onClick={() => setPickupModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSchedulePickup} disabled={pickupLoading}>
                {pickupLoading ? 'Scheduling...' : 'Confirm Pickup Request'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Shipment Modal */}
      {cancelShipmentModalOpen && (
        <Modal
          isOpen={cancelShipmentModalOpen}
          onClose={() => setCancelShipmentModalOpen(false)}
          title="Cancel Courier Shipment"
        >
          <div className="space-y-4 text-xs">
            <p className="text-stone-600">
              Cancelling will invalidate this waybill with the carrier. You can re-book fulfilment
              once packing adjustments are made.
            </p>
            <div className="space-y-1">
              <label className="font-bold text-stone-700">Reason for Cancellation</label>
              <Textarea
                placeholder="e.g. Package dimensions changed; artisan repacking in sturdier crate."
                rows={3}
                value={cancelShipmentReason}
                onChange={(e) => setCancelShipmentReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-stone-200">
              <Button variant="ghost" onClick={() => setCancelShipmentModalOpen(false)}>
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelShipment}
                disabled={cancelShipmentReason.trim().length < 3 || cancellingShipment}
              >
                {cancellingShipment ? 'Cancelling...' : 'Confirm Shipment Cancellation'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Sub-Order Cancellation Dialog Modal */}
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
